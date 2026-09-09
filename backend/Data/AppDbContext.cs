using BleProvisionApi.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace BleProvisionApi.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Camera> Cameras => Set<Camera>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>().HasIndex(u => u.Username).IsUnique();
        modelBuilder.Entity<Camera>().HasIndex(c => c.Serial).IsUnique();
    }
}
