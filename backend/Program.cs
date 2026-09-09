using System.Text;
using BleProvisionApi.Data;
using BleProvisionApi.Data.Entities;
using BleProvisionApi.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")
        ?? throw new InvalidOperationException("ConnectionStrings:Default is not configured.")));

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<CctvBackendOptions>(builder.Configuration.GetSection("CctvBackend"));
builder.Services.AddSingleton<JwtService>();
builder.Services.AddHttpClient<CctvBackendProxy>();

var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? throw new InvalidOperationException("Jwt:Secret is not configured.");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "ble-provision-api";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtIssuer,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        };
    });

// Everything requires a logged-in tester by default; only [AllowAnonymous]
// endpoints (login) opt out. Matches "login gate for this app" from how
// this backend was scoped - nothing here should be reachable without it.
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();

    // Seed one account from env so there's always a way in on a fresh
    // deploy - SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD. Every other
    // account is created via POST /api/auth/users by someone already
    // logged in.
    var seedUsername = app.Configuration["Seed:AdminUsername"];
    var seedPassword = app.Configuration["Seed:AdminPassword"];
    if (!string.IsNullOrEmpty(seedUsername) && !string.IsNullOrEmpty(seedPassword)
        && !db.Users.Any(u => u.Username == seedUsername))
    {
        db.Users.Add(new User
        {
            Username = seedUsername,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(seedPassword),
        });
        db.SaveChanges();
    }
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
