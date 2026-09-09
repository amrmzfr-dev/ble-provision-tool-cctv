using System.Security.Claims;
using BleProvisionApi.Data;
using BleProvisionApi.Data.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BleProvisionApi.Controllers;

public record UpsertCameraRequest(string Serial, string? Label);
public record CameraDto(string Serial, string? Label, string? LastStatus, DateTimeOffset? LastStatusAt, DateTimeOffset AddedAt);

[ApiController]
[Route("api/mycameras")]
public class MyCamerasController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<CameraDto>>> List()
    {
        var cameras = await db.Cameras
            .OrderByDescending(c => c.AddedAt)
            .Select(c => new CameraDto(c.Serial, c.Label, c.LastStatus, c.LastStatusAt, c.AddedAt))
            .ToListAsync();
        return Ok(cameras);
    }

    /// <summary>Upsert — called automatically once pairing reaches "connected", so this list builds itself as cameras get tested. Also callable manually to add a serial without re-pairing.</summary>
    [HttpPost]
    public async Task<ActionResult<CameraDto>> Upsert(UpsertCameraRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Serial))
        {
            return BadRequest(new { error = "invalid_input", message = "Serial is required." });
        }

        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        int? userId = int.TryParse(userIdClaim, out var parsed) ? parsed : null;

        var camera = await db.Cameras.SingleOrDefaultAsync(c => c.Serial == request.Serial);
        if (camera is null)
        {
            camera = new Camera { Serial = request.Serial, AddedByUserId = userId };
            db.Cameras.Add(camera);
        }
        if (request.Label is not null) camera.Label = request.Label;

        await db.SaveChangesAsync();
        return Ok(new CameraDto(camera.Serial, camera.Label, camera.LastStatus, camera.LastStatusAt, camera.AddedAt));
    }

    /// <summary>Cache the live status against this list entry — called by the frontend right after it refreshes a camera's status via the proxied /api/device/&lt;serial&gt;/status call, so the list shows something without a live round trip every render.</summary>
    [HttpPut("{serial}/status")]
    public async Task<IActionResult> UpdateStatus(string serial, [FromBody] string status)
    {
        var camera = await db.Cameras.SingleOrDefaultAsync(c => c.Serial == serial);
        if (camera is null) return NotFound(new { error = "not_in_list" });

        camera.LastStatus = status;
        camera.LastStatusAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{serial}")]
    public async Task<IActionResult> Remove(string serial)
    {
        var camera = await db.Cameras.SingleOrDefaultAsync(c => c.Serial == serial);
        if (camera is null) return NotFound();

        db.Cameras.Remove(camera);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
