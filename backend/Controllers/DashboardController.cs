using BleProvisionApi.Data;
using BleProvisionApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BleProvisionApi.Controllers;

public record DashboardCameraDto(
    string Serial,
    string? Label,
    string? LastStatus,
    DateTimeOffset? LastStatusAt,
    DateTimeOffset AddedAt,
    string? ConfiguredByName,
    string? LastCheckedByName
);

/// <summary>
/// Read-only ledger for cctv-provision.czeros.tech/dashboard - who configured
/// (paired) each camera and who last actually tested/checked it, so there's
/// an answer to "who's responsible for this one" if an issue comes up later.
/// Gated on the "admin" role claim (AdminOnly policy, Program.cs) - a normal
/// tester's login token, even though it's valid, gets a 403 here.
/// </summary>
[ApiController]
[Route("api/dashboard")]
[Authorize(Policy = "AdminOnly")]
public class DashboardController(AppDbContext db, CctvBackendProxy proxy) : ControllerBase
{
    /// <summary>
    /// Factory reset, straight to the real backend - same admin/device/{serial}/reset
    /// call the tester app's own "Reset for redeployment" button makes, just
    /// reachable from the dashboard for a camera the tester app never even
    /// listed (e.g. one nobody paired through this tool, only visible via
    /// All Cameras). Only works while the device is actively connected - the
    /// real backend refuses it otherwise, and that refusal (with its real
    /// message) is passed straight back rather than turned into a generic error.
    /// </summary>
    [HttpPost("cameras/{serial}/reset")]
    public async Task<IActionResult> ResetCamera(string serial)
    {
        var (success, statusCode, body) = await proxy.PostJsonAsync($"admin/device/{serial}/reset", new { factory_reset = true, confirm = true });
        if (!success)
        {
            var message = body?.TryGetProperty("message", out var m) == true ? m.GetString() : "Reset failed.";
            return StatusCode(statusCode, new { error = "reset_failed", message });
        }
        return Ok(new { success = true });
    }

    [HttpGet("cameras")]
    public async Task<ActionResult<List<DashboardCameraDto>>> ListCameras()
    {
        var cameras = await db.Cameras.OrderByDescending(c => c.AddedAt).ToListAsync();

        var userIds = cameras
            .SelectMany(c => new[] { c.AddedByUserId, c.LastCheckedByUserId })
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        var displayNameById = await db.Users
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName);

        var result = cameras.Select(c => new DashboardCameraDto(
            c.Serial,
            c.Label,
            c.LastStatus,
            c.LastStatusAt,
            c.AddedAt,
            c.AddedByUserId.HasValue && displayNameById.TryGetValue(c.AddedByUserId.Value, out var configuredByName) ? configuredByName : null,
            c.LastCheckedByUserId.HasValue && displayNameById.TryGetValue(c.LastCheckedByUserId.Value, out var checkedByName) ? checkedByName : null
        ));

        return Ok(result);
    }
}
