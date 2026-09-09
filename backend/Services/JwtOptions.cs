namespace BleProvisionApi.Services;

public class JwtOptions
{
    public required string Secret { get; set; }
    public string Issuer { get; set; } = "ble-provision-api";
    public int ExpiryHours { get; set; } = 12;
}
