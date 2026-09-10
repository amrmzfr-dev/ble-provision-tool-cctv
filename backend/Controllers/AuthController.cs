using BleProvisionApi.Data;
using BleProvisionApi.Data.Entities;
using BleProvisionApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace BleProvisionApi.Controllers;

public record LoginRequest(string Username, string Password);
public record LoginResponse(string Token, string Username, bool IsAdmin);
public record CreateUserRequest(string Username, string Password);

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, JwtService jwtService) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var user = await db.Users.SingleOrDefaultAsync(u => u.Username == request.Username);
        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { error = "invalid_credentials" });
        }

        return Ok(new LoginResponse(jwtService.CreateToken(user), user.Username, user.IsAdmin));
    }

    [HttpGet("me")]
    public ActionResult<object> Me()
    {
        return Ok(new { username = User.Identity?.Name });
    }

    /// <summary>
    /// Any logged-in tester can create another tester's account - always a
    /// plain (non-admin) one; this endpoint has no IsAdmin field at all.
    /// Creating/promoting an admin account is DashboardUsersController's job
    /// (/dashboard/users), gated on already being an admin - a compromised
    /// tester token can never grant itself dashboard access through here.
    /// </summary>
    [HttpPost("users")]
    public async Task<IActionResult> CreateUser(CreateUserRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || request.Password.Length < 8)
        {
            return BadRequest(new { error = "invalid_input", message = "Username required, password must be at least 8 characters." });
        }

        if (await db.Users.AnyAsync(u => u.Username == request.Username))
        {
            return Conflict(new { error = "username_taken" });
        }

        db.Users.Add(new User
        {
            Username = request.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
        });
        await db.SaveChangesAsync();
        return Created(string.Empty, new { success = true });
    }
}
