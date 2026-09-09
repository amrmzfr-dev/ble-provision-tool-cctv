namespace BleProvisionApi.Data.Entities;

/// <summary>
/// A camera this tool has been used to pair/test - a personal "revisit list"
/// so a tester can come back to a camera's status/stream/reset controls
/// without redoing the whole scan-and-pair flow. Not an event log: one row
/// per serial, upserted every time it's touched. The real camera backend
/// (cctv.czeros.tech) remains the source of truth for live status/history -
/// this just remembers which serials this tool has dealt with.
/// </summary>
public class Camera
{
    public int Id { get; set; }
    public required string Serial { get; set; }
    public string? Label { get; set; }

    /// <summary>Last status seen from the real backend (e.g. "connected", "waiting_for_connection") - a cache for quick display, refreshed on demand via the existing status proxy endpoint.</summary>
    public string? LastStatus { get; set; }
    public DateTimeOffset? LastStatusAt { get; set; }

    public DateTimeOffset AddedAt { get; set; } = DateTimeOffset.UtcNow;
    public int? AddedByUserId { get; set; }
}
