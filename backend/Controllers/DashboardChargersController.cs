using System.Text.Json;
using BleProvisionApi.Data;
using BleProvisionApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BleProvisionApi.Controllers;

public record DashboardChargerDto(
    string Serial,
    string? Ip,
    string? Status,
    bool Connected,
    string? RegistrationTime,
    string? PicName
);

/// <summary>
/// Every device the real camera backend has ever seen (cctv.czeros.tech's
/// own devices table + in-memory connection state), not just the ones
/// paired through this app - reuses the same X-Admin-Key-backed
/// admin/cameras endpoint the tester app's "Refresh all" already calls via
/// CctvBackendProxy, so this needed no new access, just a new admin-only
/// view of it. PicName is a best-effort overlay from our own Cameras table
/// where we happen to know who configured that serial - most devices out
/// there were never touched by this tool at all and simply won't have one.
/// </summary>
[ApiController]
[Route("api/dashboard/chargers")]
[Authorize(Policy = "AdminOnly")]
public class DashboardChargersController(CctvBackendProxy proxy, AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<DashboardChargerDto>>> List()
    {
        JsonElement bulk;
        try
        {
            bulk = await proxy.GetJsonAsync("admin/cameras");
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { error = "backend_unreachable", message = ex.Message });
        }

        var ownCameras = await db.Cameras.ToDictionaryAsync(c => c.Serial);
        var userIds = ownCameras.Values
            .Where(c => c.AddedByUserId.HasValue)
            .Select(c => c.AddedByUserId!.Value)
            .Distinct()
            .ToList();
        var displayNameById = await db.Users
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName);

        var result = new List<DashboardChargerDto>();
        if (bulk.ValueKind == JsonValueKind.Array)
        {
            foreach (var entry in bulk.EnumerateArray())
            {
                if (!entry.TryGetProperty("serial", out var serialProp) || serialProp.GetString() is not { } serial)
                {
                    continue;
                }

                string? picName = ownCameras.TryGetValue(serial, out var ours) && ours.AddedByUserId.HasValue
                    && displayNameById.TryGetValue(ours.AddedByUserId.Value, out var name)
                    ? name
                    : null;

                result.Add(new DashboardChargerDto(
                    serial,
                    entry.TryGetProperty("ip", out var ip) ? ip.GetString() : null,
                    entry.TryGetProperty("status", out var status) ? status.GetString() : null,
                    entry.TryGetProperty("connected", out var connected) && connected.ValueKind == JsonValueKind.True,
                    entry.TryGetProperty("registration_time", out var regTime) ? regTime.GetString() : null,
                    picName
                ));
            }
        }

        return Ok(result.OrderByDescending(c => c.Connected).ThenBy(c => c.Serial));
    }
}
