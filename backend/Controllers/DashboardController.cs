using BleProvisionApi.Data;
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
    string? ConfiguredByUsername,
    string? ConfiguredByName,
    string? LastCheckedByUsername
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
public class DashboardController(AppDbContext db) : ControllerBase
{
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

        var usersById = await db.Users
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => new { u.Username, u.DisplayName });

        var result = cameras.Select(c => new DashboardCameraDto(
            c.Serial,
            c.Label,
            c.LastStatus,
            c.LastStatusAt,
            c.AddedAt,
            c.AddedByUserId.HasValue && usersById.TryGetValue(c.AddedByUserId.Value, out var configuredBy) ? configuredBy.Username : null,
            c.AddedByUserId.HasValue && usersById.TryGetValue(c.AddedByUserId.Value, out var configuredByName) ? configuredByName.DisplayName : null,
            c.LastCheckedByUserId.HasValue && usersById.TryGetValue(c.LastCheckedByUserId.Value, out var checkedBy) ? checkedBy.Username : null
        ));

        return Ok(result);
    }
}
