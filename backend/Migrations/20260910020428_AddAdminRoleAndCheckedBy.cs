using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BleProvisionApi.Migrations
{
    /// <inheritdoc />
    public partial class AddAdminRoleAndCheckedBy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsAdmin",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "LastCheckedByUserId",
                table: "Cameras",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsAdmin",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastCheckedByUserId",
                table: "Cameras");
        }
    }
}
