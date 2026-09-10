namespace BleProvisionApi.Data.Entities;

public class User
{
    public int Id { get; set; }
    public required string Username { get; set; }
    public required string PasswordHash { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>Grants access to the /dashboard ledger (Controllers/DashboardController.cs) - everyone else logging in still only gets the normal tester app.</summary>
    public bool IsAdmin { get; set; }

    /// <summary>The PIC's real name (e.g. "Syafiq") - Username stays the login id (e.g. "czeroteam1"). Settable via /dashboard/users (DashboardUsersController), same as IsAdmin.</summary>
    public string? DisplayName { get; set; }
}
