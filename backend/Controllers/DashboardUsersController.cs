using BleProvisionApi.Data;
using BleProvisionApi.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BleProvisionApi.Controllers;

public record DashboardUserDto(int Id, string Username, string? DisplayName, bool IsAdmin, DateTimeOffset CreatedAt);
public record DashboardCreateUserRequest(string Username, string Password, string? DisplayName, bool IsAdmin);
public record DashboardUpdateUserRequest(string? DisplayName, bool? IsAdmin, string? Password);

/// <summary>
/// User management for /dashboard/users - the one place IsAdmin can actually
/// be granted through the API now (previously only a one-off DB update). All
/// gated on AdminOnly (Program.cs), same as DashboardController, so only an
/// existing admin can create/promote another one - no open escalation path.
/// </summary>
[ApiController]
[Route("api/dashboard/users")]
[Authorize(Policy = "AdminOnly")]
public class DashboardUsersController(AppDbContext db) : ControllerBase
{
    private static DashboardUserDto ToDto(User u) => new(u.Id, u.Username, u.DisplayName, u.IsAdmin, u.CreatedAt);

    [HttpGet]
    public async Task<ActionResult<List<DashboardUserDto>>> List()
    {
        var users = await db.Users.OrderBy(u => u.Username).ToListAsync();
        return Ok(users.Select(ToDto));
    }

    [HttpPost]
    public async Task<ActionResult<DashboardUserDto>> Create(DashboardCreateUserRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || request.Password.Length < 8)
        {
            return BadRequest(new { error = "invalid_input", message = "Username required, password must be at least 8 characters." });
        }
        if (await db.Users.AnyAsync(u => u.Username == request.Username))
        {
            return Conflict(new { error = "username_taken" });
        }

        var user = new User
        {
            Username = request.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? null : request.DisplayName,
            IsAdmin = request.IsAdmin,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return Created(string.Empty, ToDto(user));
    }

    /// <summary>
    /// Partial update - DisplayName/IsAdmin/Password are each only touched
    /// when present in the request. Refuses to demote or delete the last
    /// remaining admin (Update/Delete both check this) - that would lock
    /// everyone out of /dashboard with no way back in short of a direct DB
    /// update, the same class of problem IsAdmin used to require anyway.
    /// </summary>
    [HttpPut("{username}")]
    public async Task<ActionResult<DashboardUserDto>> Update(string username, DashboardUpdateUserRequest request)
    {
        var user = await db.Users.SingleOrDefaultAsync(u => u.Username == username);
        if (user is null) return NotFound();

        if (request.DisplayName is not null)
        {
            user.DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? null : request.DisplayName;
        }

        if (request.IsAdmin is not null && request.IsAdmin != user.IsAdmin)
        {
            if (!request.IsAdmin.Value && await db.Users.CountAsync(u => u.IsAdmin) <= 1)
            {
                return BadRequest(new { error = "last_admin", message = "Can't remove the last remaining admin." });
            }
            user.IsAdmin = request.IsAdmin.Value;
        }

        if (!string.IsNullOrEmpty(request.Password))
        {
            if (request.Password.Length < 8)
            {
                return BadRequest(new { error = "invalid_input", message = "Password must be at least 8 characters." });
            }
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
        }

        await db.SaveChangesAsync();
        return Ok(ToDto(user));
    }

    [HttpDelete("{username}")]
    public async Task<IActionResult> Delete(string username)
    {
        var user = await db.Users.SingleOrDefaultAsync(u => u.Username == username);
        if (user is null) return NotFound();

        if (user.IsAdmin && await db.Users.CountAsync(u => u.IsAdmin) <= 1)
        {
            return BadRequest(new { error = "last_admin", message = "Can't delete the last remaining admin." });
        }

        // Cameras this user configured/last-checked (Camera.AddedByUserId /
        // LastCheckedByUserId) aren't cleaned up here - no FK constraint ties
        // them together, so those rows just keep pointing at an id that no
        // longer resolves to a name. Acceptable for this tool: it only means
        // the ledger shows "—" for that attribution going forward, nothing
        // breaks.
        db.Users.Remove(user);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
