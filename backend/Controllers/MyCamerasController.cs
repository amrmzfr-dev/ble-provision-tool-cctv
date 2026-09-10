using System.Security.Claims;
using BleProvisionApi.Data;
using BleProvisionApi.Data.Entities;
using BleProvisionApi.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BleProvisionApi.Controllers;

public record UpsertCameraRequest(string Serial, string? Label);
public record CameraDto(string Serial, string? Label, string? LastStatus, DateTimeOffset? LastStatusAt, DateTimeOffset AddedAt);

[ApiController]
[Route("api/mycameras")]
public class MyCamerasController(AppDbContext db, CctvBackendProxy proxy, ILogger<MyCamerasController> logger) : ControllerBase
{
    /// <summary>
    /// Every endpoint here is scoped to whoever's logged in - this list is
    /// personal, not shared: pairing a camera binds it to your account only,
    /// and it never shows up for anyone else. The full cross-account picture
    /// (who configured/tested what) lives only in the admin dashboard
    /// (DashboardController), not here.
    /// </summary>
    private int? CurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    [HttpGet]
    public async Task<ActionResult<List<CameraDto>>> List()
    {
        var userId = CurrentUserId();
        var cameras = await db.Cameras
            .Where(c => c.AddedByUserId == userId)
            .OrderByDescending(c => c.AddedAt)
            .Select(c => new CameraDto(c.Serial, c.Label, c.LastStatus, c.LastStatusAt, c.AddedAt))
            .ToListAsync();
        return Ok(cameras);
    }

    /// <summary>
    /// Upsert - called automatically once pairing reaches "connected", so
    /// this list builds itself as cameras get tested. Also callable manually
    /// to add a serial without re-pairing. Always claims/re-claims ownership
    /// for whoever's calling this, even if the serial already belonged to
    /// someone else (e.g. a camera factory-reset and re-paired by a
    /// different tester) - it moves to the new owner's list and off the old
    /// one's, since "who configured it" should reflect the most recent real
    /// pairing, not the first one ever.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<CameraDto>> Upsert(UpsertCameraRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Serial))
        {
            return BadRequest(new { error = "invalid_input", message = "Serial is required." });
        }

        var userId = CurrentUserId();

        var camera = await db.Cameras.SingleOrDefaultAsync(c => c.Serial == request.Serial);
        if (camera is null)
        {
            camera = new Camera { Serial = request.Serial };
            db.Cameras.Add(camera);
        }
        camera.AddedByUserId = userId;
        camera.AddedAt = DateTimeOffset.UtcNow;
        if (request.Label is not null) camera.Label = request.Label;

        await db.SaveChangesAsync();
        return Ok(new CameraDto(camera.Serial, camera.Label, camera.LastStatus, camera.LastStatusAt, camera.AddedAt));
    }

    /// <summary>
    /// Cache the live status against this list entry - called by the frontend
    /// right after it refreshes a camera's status via the proxied
    /// /api/device/&lt;serial&gt;/status call, so the list shows something
    /// without a live round trip every render. Also records who ran this
    /// specific check - CameraDetailScreen calls this, the periodic
    /// background poll on the list screen (RefreshAll below) doesn't, so this
    /// reflects someone deliberately opening and testing this camera, not a
    /// passive auto-refresh - the "who tested it" half of the dashboard
    /// ledger (DashboardController).
    /// </summary>
    [HttpPut("{serial}/status")]
    public async Task<IActionResult> UpdateStatus(string serial, [FromBody] string status)
    {
        var userId = CurrentUserId();
        var camera = await db.Cameras.SingleOrDefaultAsync(c => c.Serial == serial && c.AddedByUserId == userId);
        if (camera is null) return NotFound(new { error = "not_in_list" });

        camera.LastCheckedByUserId = userId;

        camera.LastStatus = status;
        camera.LastStatusAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Refreshes every camera in the list with one call instead of one
    /// request per row: the real backend's /admin/cameras already returns
    /// every camera's live status in a single response, so this fetches
    /// that once and filters it down to just what's in this list, updating
    /// all of them in one batch.
    /// </summary>
    [HttpPost("refresh")]
    public async Task<ActionResult<List<CameraDto>>> RefreshAll()
    {
        var userId = CurrentUserId();
        var cameras = await db.Cameras.Where(c => c.AddedByUserId == userId).ToListAsync();
        if (cameras.Count == 0) return Ok(new List<CameraDto>());

        System.Text.Json.JsonElement bulk;
        try
        {
            bulk = await proxy.GetJsonAsync("admin/cameras");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Bulk camera refresh failed to reach the camera backend");
            return StatusCode(StatusCodes.Status502BadGateway, new { error = "backend_unreachable", message = ex.Message });
        }

        var statusBySerial = new Dictionary<string, string>();
        if (bulk.ValueKind == System.Text.Json.JsonValueKind.Array)
        {
            foreach (var entry in bulk.EnumerateArray())
            {
                if (entry.TryGetProperty("serial", out var serialProp) &&
                    entry.TryGetProperty("status", out var statusProp) &&
                    serialProp.GetString() is { } serial)
                {
                    statusBySerial[serial] = statusProp.GetString() ?? "unknown";
                }
            }
        }

        var now = DateTimeOffset.UtcNow;
        foreach (var camera in cameras)
        {
            if (statusBySerial.TryGetValue(camera.Serial, out var status))
            {
                camera.LastStatus = status;
                camera.LastStatusAt = now;
            }
            // Not in the bulk list at all (never registered with the camera
            // backend, or it's been restarted since) - leave the last known
            // status alone rather than overwriting it with a guess.
        }
        await db.SaveChangesAsync();

        return Ok(cameras
            .OrderByDescending(c => c.AddedAt)
            .Select(c => new CameraDto(c.Serial, c.Label, c.LastStatus, c.LastStatusAt, c.AddedAt)));
    }

    [HttpDelete("{serial}")]
    public async Task<IActionResult> Remove(string serial)
    {
        var userId = CurrentUserId();
        var camera = await db.Cameras.SingleOrDefaultAsync(c => c.Serial == serial && c.AddedByUserId == userId);
        if (camera is null) return NotFound();

        db.Cameras.Remove(camera);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
