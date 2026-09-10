import { AlertTriangle, Check, Copy, Dices, Loader2, Pencil, Plus, ShieldCheck, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  createDashboardUser,
  deleteDashboardUser,
  listDashboardUsers,
  updateDashboardUser,
  type DashboardUser,
} from '@/lib/api/dashboardUsersClient'
import { DashboardApiError } from '@/lib/api/dashboardConfig'
import { cn } from '@/lib/utils'

// Ambiguous characters (I/l/1, O/0) left out - these get read back and typed
// in by hand onto a phone, unlike the account creating them.
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

function generatePassword(length = 12): string {
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join('')
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}

type EditingUser = DashboardUser | 'new'

/**
 * User management for /dashboard/users - create testers/admins, rename them
 * (DisplayName - what shows on the camera ledger), promote/demote, reset a
 * forgotten password, or remove an account entirely. Backend enforces the
 * one hard rule client-side can't: the last remaining admin can't be
 * demoted or deleted (DashboardUsersController), so there's always a way
 * back into this page.
 */
export function DashboardUsersPage() {
  const [users, setUsers] = useState<DashboardUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditingUser | null>(null)
  const [confirmDeleteUsername, setConfirmDeleteUsername] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    try {
      const data = await listDashboardUsers()
      setUsers(data)
      setError(null)
    } catch (err) {
      setError(err instanceof DashboardApiError ? err.message : 'Could not load users.')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const confirmDelete = async () => {
    if (!confirmDeleteUsername) return
    setDeleting(true)
    try {
      await deleteDashboardUser(confirmDeleteUsername)
      setConfirmDeleteUsername(null)
      await load()
    } catch (err) {
      setError(err instanceof DashboardApiError ? err.message : 'Could not delete that user.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex max-w-4xl flex-col gap-4 px-5 py-6">
      <h1 className="text-lg leading-tight font-black tracking-tight uppercase">Users</h1>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Testers and admins who can sign in</p>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus />
          New user
        </Button>
      </div>

      {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {users === null && !error ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        users && (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="p-3 font-semibold">#</th>
                  <th className="p-3 font-semibold">Name</th>
                  <th className="p-3 font-semibold">Username</th>
                  <th className="p-3 font-semibold">Role</th>
                  <th className="p-3 font-semibold">Created</th>
                  <th className="p-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="p-3 text-muted-foreground">{i + 1}</td>
                    <td className="p-3 font-medium uppercase">{u.displayName ?? '—'}</td>
                    <td className="p-3 font-mono">{u.username}</td>
                    <td className="p-3">
                      {u.isAdmin ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary uppercase">
                          <ShieldCheck className="size-3" />
                          Admin
                        </span>
                      ) : (
                        <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground uppercase">
                          Tester
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">{formatDate(u.createdAt)}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(u)} aria-label={`Edit ${u.username}`}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => setConfirmDeleteUsername(u.username)}
                          aria-label={`Delete ${u.username}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {editing && (
        <UserEditorModal
          user={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void load()
          }}
        />
      )}

      {confirmDeleteUsername && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setConfirmDeleteUsername(null)}
        >
          <div className="w-full max-w-xs rounded-2xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase">
              <AlertTriangle className="size-4 text-destructive" />
              Delete this user?
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              <code className="text-foreground">{confirmDeleteUsername}</code> will no longer be able to sign in. Cameras
              they configured stay in the ledger, just without a name attached.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDeleteUsername(null)}>
                Cancel
              </Button>
              <Button variant="destructive" className="flex-1" disabled={deleting} onClick={() => void confirmDelete()}>
                {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface UserEditorModalProps {
  /** null = creating a new user. */
  user: DashboardUser | null
  onClose: () => void
  onSaved: () => void
}

function UserEditorModal({ user, onClose, onSaved }: UserEditorModalProps) {
  const isNew = user === null
  const [username, setUsername] = useState(user?.username ?? '')
  const [password, setPassword] = useState('')
  const [copied, setCopied] = useState(false)
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [isAdmin, setIsAdmin] = useState(user?.isAdmin ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = () => {
    setPassword(generatePassword())
    setCopied(false)
  }

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard permission denied or unavailable - nothing more we can do here.
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      if (isNew) {
        if (!username.trim() || password.length < 8) {
          setError('Username required, password must be at least 8 characters.')
          return
        }
        await createDashboardUser({ username: username.trim(), password, displayName: displayName.trim() || undefined, isAdmin })
      } else {
        await updateDashboardUser(user.username, {
          displayName: displayName.trim(),
          isAdmin,
          password: password.length > 0 ? password : undefined,
        })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof DashboardApiError ? err.message : 'Could not save this user.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-black uppercase tracking-tight">{isNew ? 'New user' : `Edit ${user.username}`}</span>
          <Button variant="ghost" size="icon" className="size-8" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {isNew && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase">Username</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" data-1p-ignore data-lpignore="true" />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase">
              {isNew ? 'Password' : 'Reset password (optional)'}
            </label>
            <div className="flex gap-2">
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isNew ? undefined : 'Leave blank to keep current'}
                autoComplete="new-password"
                data-1p-ignore
                data-lpignore="true"
              />
              <Button type="button" variant="outline" size="icon" onClick={handleGenerate} aria-label="Generate password">
                <Dices />
              </Button>
              {password && (
                <Button type="button" variant="outline" size="icon" onClick={() => void handleCopyPassword()} aria-label="Copy password">
                  {copied ? <Check className="text-lime" /> : <Copy />}
                </Button>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase">Display name</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Syafiq" />
          </div>

          <button
            type="button"
            onClick={() => setIsAdmin((a) => !a)}
            className={cn(
              'flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors',
              isAdmin ? 'border-primary/40 bg-primary/10' : 'border-border bg-transparent',
            )}
          >
            <ShieldCheck className={cn('size-4', isAdmin ? 'text-primary' : 'text-muted-foreground')} />
            <span className="flex-1">
              <span className="block font-medium">Dashboard admin</span>
              <span className="block text-xs text-muted-foreground">Can sign into /dashboard and see everything here.</span>
            </span>
            <span
              className={cn(
                'flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
                isAdmin ? 'justify-end bg-primary' : 'justify-start bg-border',
              )}
            >
              <span className="size-4 rounded-full bg-white" />
            </span>
          </button>

          {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

          <Button onClick={() => void handleSave()} disabled={saving} size="lg">
            {saving && <Loader2 className="animate-spin" />}
            {isNew ? 'Create user' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
