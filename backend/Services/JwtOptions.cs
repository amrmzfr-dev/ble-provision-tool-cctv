namespace BleProvisionApi.Services;

public class JwtOptions
{
    public required string Secret { get; set; }
    public string Issuer { get; set; } = "ble-provision-api";
    // Effectively never (~100 years) - logins stay valid until someone
    // explicitly signs out (client-side), not on a timer. There's no
    // server-side revocation list, so a leaked token is also valid for that
    // long; acceptable for this small internal testing tool.
    public int ExpiryHours { get; set; } = 876000;
}
