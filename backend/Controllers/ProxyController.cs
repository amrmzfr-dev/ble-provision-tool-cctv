using BleProvisionApi.Services;
using Microsoft.AspNetCore.Mvc;

namespace BleProvisionApi.Controllers;

/// <summary>
/// Catch-all for everything that isn't this backend's own auth/mycameras
/// endpoints — /api/device/*, /api/admin/*, /api/stream/*, etc. all forward
/// to the real camera backend with the admin key attached server-side. The
/// frontend's existing typed client (src/lib/api/client.ts) already calls
/// these exact relative paths; nothing about their shape changes, only that
/// the browser now authenticates to this API (JWT) instead of holding the
/// camera backend's own key directly.
///
/// ASP.NET Core routing prefers the more specific "api/auth" and
/// "api/mycameras" attribute routes over this catch-all automatically, so
/// no explicit exclusion list is needed here.
/// </summary>
[ApiController]
[Route("api/{**path}")]
public class ProxyController(CctvBackendProxy proxy) : ControllerBase
{
    [HttpGet]
    [HttpPost]
    [HttpPut]
    [HttpDelete]
    public Task Forward(string path) => proxy.ForwardAsync(HttpContext, path);
}
