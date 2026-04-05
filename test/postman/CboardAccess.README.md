# Cboard Access Postman Collection

This Postman collection provides comprehensive testing and administration capabilities for the Cboard Access feature.

## Overview

Cboard Access allows businesses to offer AAC boards in their locations via QR codes or access codes. This collection tests both public endpoints (used by end users) and admin endpoints (for managing clients).

## Collection Structure

### 1. Setup
- **Login to Get Auth Token**: Obtain authentication token for admin endpoints

### 2. Admin Endpoints (Require Authentication)
- **Create Access Client**: Create a new Cboard Access client
- **List All Clients**: View all registered clients with statistics
- **Update Client**: Modify client information
- **Deactivate Client**: Disable a client by setting `isActive` to false
- **View Statistics**: Get detailed stats for a specific client

### 3. Public Endpoints (No Authentication)
- **Test Public Client Listing**: List active clients for app display
- **Test Public Board Access**: Access boards via access code

## Setup Instructions

### Prerequisites

**IMPORTANT: You need an admin user to test admin endpoints.**

To create an admin user, update your user's role in MongoDB:
```javascript
// In MongoDB shell or Compass
db.users.updateOne(
  { email: "your-email@example.com" },
  { $set: { role: "admin" } }
)
```

### 1. Import the Collection

1. Open Postman
2. Click **Import** button
3. Select `CboardAccess.collection.json`
4. The collection will be imported with default variables

### 2. Configure Variables

The collection includes these variables (can be edited in collection variables or create an environment):

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `API_URL` | `http://localhost:10010` | Base API URL |
| `AUTH_TOKEN` | (empty) | Authentication token for admin endpoints |
| `access_code` | `TEST01` | Access code for testing |
| `root_board_id` | (empty) | Board ID to use as root board |

### 3. Optional: Create Environment

You can create a custom environment for different deployment targets:

**Local Development:**
```json
{
  "API_URL": "http://localhost:10010",
  "root_board_id": "your-board-id-here"
}
```

**QA Environment:**
```json
{
  "API_URL": "https://api-qa.cboard.io",
  "root_board_id": "qa-board-id"
}
```

**Production:**
```json
{
  "API_URL": "https://api.cboard.io",
  "root_board_id": "production-board-id"
}
```

## Usage Workflow

### First Time Setup

1. **Get a Board ID**
   - Create a board in Cboard or use an existing one
   - Copy the board ID
   - Set it in the `root_board_id` variable

2. **Authenticate**
   - Update credentials in "Login to Get Auth Token" request
   - Run the request
   - The `AUTH_TOKEN` variable will be automatically set from the response

### Creating a Client

1. Run **Create Access Client** with your desired configuration:
   ```json
   {
     "code": "CAFE01",
     "clientName": "Coffee Shop Downtown",
     "clientContact": "manager@coffee.com",
     "brandColor": "#8B4513",
     "rootBoardId": "{{root_board_id}}",
     "subscriptionStart": "2026-04-01T00:00:00.000Z",
     "subscriptionEnd": "2027-04-01T00:00:00.000Z",
     "boardIds": ["{{root_board_id}}"]
   }
   ```

2. The response will include the created client
3. The `access_code` variable will be automatically updated

### Testing the Client

1. **Admin View**: Run "List All Clients" to see the client with statistics
2. **Public View**: Run "Test Public Client Listing" to see how it appears in the app
3. **Access Boards**: Run "Test Public Board Access" to retrieve the boards
4. **View Stats**: Run "View Statistics" to see detailed analytics

### Updating or Deactivating

- Use **Update Client** to modify properties
- Use **Deactivate Client** to disable access without deleting

## Request Details

### Create Access Client

**Required Fields:**
- `code`: Unique identifier (uppercase, alphanumeric)
- `clientName`: Display name
- `rootBoardId`: ID of the main board
- `subscriptionStart`: Start date (ISO 8601)
- `subscriptionEnd`: End date (ISO 8601)

**Optional Fields:**
- `clientContact`: Contact information
- `brandColor`: Hex color code (default: `#1976d2`)
- `boardIds`: Array of board IDs to associate

### Update Client

**Updatable Fields:**
- `clientName`
- `clientContact`
- `brandColor`
- `isActive` (boolean)
- `isListedInApp` (boolean)
- `subscriptionStart`
- `subscriptionEnd`

### Public Endpoints

These endpoints don't require authentication and simulate real user access:

- **GET /access/clients**: Returns only active, listed clients with valid subscriptions
- **GET /access/:code**: Returns all boards for the access code and increments access counter

## Test Scripts

Each request includes automated tests:

- **Status code validation**: Ensures correct HTTP responses
- **Response structure validation**: Checks for required fields
- **Variable auto-setting**: Saves tokens and IDs for subsequent requests

## Common Scenarios

### Scenario 1: New Client Onboarding

1. Login to get auth token
2. Create access client
3. Verify in "List All Clients"
4. Test public access

### Scenario 2: Client Expiration

1. Create client with near expiration date
2. View statistics to see `daysUntilExpiry`
3. Update subscription dates to extend
4. Verify expiration status updated

### Scenario 3: Temporary Deactivation

1. Deactivate client
2. Verify it doesn't appear in public listing
3. Update to reactivate
4. Verify it reappears in public listing

## Troubleshooting

### AUTH_TOKEN Not Being Set After Login
- Check the Postman Console (View → Show Postman Console) for error messages
- Verify your email and password are correct in the login request body
- Make sure the API server is running (`npm run dev` in cboard-api)
- Check that the response contains `authToken` field

### 403 Forbidden on Admin Endpoints
- **You need an admin user!** By default, all users have `role: "user"`
- Update your user to admin role in MongoDB:
  ```javascript
  db.users.updateOne(
    { email: "your-email@example.com" },
    { $set: { role: "admin" } }
  )
  ```
- After updating, log in again to get a new token with admin privileges

### "Invalid access code" Error
- Ensure the client is active (`isActive: true`)
- Check subscription dates are valid
- Verify `isListedInApp` is true for public listing

### Authentication Errors
- Ensure `AUTH_TOKEN` is set (run login request)
- Check token hasn't expired
- Verify user has admin privileges (role: "admin")

### Board Not Found
- Ensure `root_board_id` exists in the database
- Check board hasn't been deleted
- Verify board belongs to the authenticated user

## Related Documentation

- [Implementation Plan](../../CBOARD_ACCESS_IMPLEMENTATION_PLAN.md)
- [GitHub Issue #446](https://github.com/cboard-org/cboard-api/issues/446)
- [Parent Issue #439](https://github.com/cboard-org/cboard-api/issues/439)

## Notes

- All admin endpoints require authentication via Bearer token
- Public endpoints are rate-limited (if configured)
- Access count is automatically incremented on each board access
- Subscription dates are checked against current server time
