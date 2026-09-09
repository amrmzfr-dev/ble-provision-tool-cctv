using Microsoft.Extensions.Options;

namespace BleProvisionApi.Services;

/// <summary>
/// The one place the real camera backend's X-Admin-Key ever exists. The
/// browser authenticates to THIS api with its own login (JWT) and never
/// sees that key — every /api/device/* and /api/admin/* call the frontend
/// makes gets forwarded here with the real key attached server-side.
///
/// Streaming matters: /api/admin/stream/&lt;uuid&gt; is an effectively-infinite
/// live response. HttpCompletionOption.ResponseHeadersRead plus copying the
/// content stream directly to the outgoing response (no intermediate byte
/// array) keeps this from buffering the whole thing — the same class of bug
/// already hit once with nginx's default proxy_buffering on the frontend
/// container; buffering here would reintroduce it one layer deeper.
/// </summary>
public class CctvBackendProxy(HttpClient httpClient, IOptions<CctvBackendOptions> options, ILogger<CctvBackendProxy> logger)
{
    private readonly CctvBackendOptions _options = options.Value;

    public async Task ForwardAsync(HttpContext context, string path)
    {
        var targetUrl = $"{_options.BaseUrl.TrimEnd('/')}/api/{path}{context.Request.QueryString}";

        using var forwardRequest = new HttpRequestMessage(new HttpMethod(context.Request.Method), targetUrl);

        if (HttpMethods.IsPost(context.Request.Method) || HttpMethods.IsPut(context.Request.Method))
        {
            forwardRequest.Content = new StreamContent(context.Request.Body);
            if (context.Request.ContentType is not null)
            {
                forwardRequest.Content.Headers.TryAddWithoutValidation("Content-Type", context.Request.ContentType);
            }
        }

        // The real key, injected here only — never trust/forward anything
        // the browser sent for this header.
        forwardRequest.Headers.Remove("X-Admin-Key");
        forwardRequest.Headers.TryAddWithoutValidation("X-Admin-Key", _options.AdminKey);

        HttpResponseMessage response;
        try
        {
            response = await httpClient.SendAsync(
                forwardRequest,
                HttpCompletionOption.ResponseHeadersRead,
                context.RequestAborted
            );
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            logger.LogError(ex, "Failed to reach camera backend at {TargetUrl}", targetUrl);
            context.Response.StatusCode = StatusCodes.Status502BadGateway;
            await context.Response.WriteAsJsonAsync(new { error = "backend_unreachable", message = ex.Message });
            return;
        }

        using (response)
        {
            context.Response.StatusCode = (int)response.StatusCode;
            if (response.Content.Headers.ContentType is not null)
            {
                context.Response.ContentType = response.Content.Headers.ContentType.ToString();
            }

            await using var upstream = await response.Content.ReadAsStreamAsync(context.RequestAborted);
            await upstream.CopyToAsync(context.Response.Body, context.RequestAborted);
        }
    }
}
