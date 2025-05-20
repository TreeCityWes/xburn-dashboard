# Metabase Setup Guide for XEN Burn Analytics

This guide will help you set up Metabase to visualize the XEN Burn Analytics data.

## Prerequisites

- Docker and Docker Compose installed
- XEN Burn Analytics backend running and collecting data
- PostgreSQL database populated with burn events and analytics

## 1. Running Metabase with Docker

Create a `docker-compose.yml` file with the following content:

```yaml
version: '3'
services:
  metabase:
    image: metabase/metabase:latest
    container_name: xburn-metabase
    ports:
      - "3030:3000"
    environment:
      MB_DB_TYPE: postgres
      MB_DB_DBNAME: metabase
      MB_DB_PORT: 5432
      MB_DB_USER: metabase_user
      MB_DB_PASS: metabase_password
      MB_DB_HOST: postgres
    depends_on:
      - postgres
    volumes:
      - ./metabase-data:/metabase-data
    restart: unless-stopped

  postgres:
    image: postgres:14
    container_name: xburn-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: xen_burn_analytics
    volumes:
      - ./postgres-data:/var/lib/postgresql/data
      - ./schema.sql:/docker-entrypoint-initdb.d/schema.sql
    restart: unless-stopped
```

Start the containers:

```bash
docker-compose up -d
```

## 2. Initial Metabase Setup

1. Open a browser and navigate to `http://localhost:3030`
2. Follow the setup wizard to create an admin account
3. Connect to your PostgreSQL database:
   - Database Type: PostgreSQL
   - Name: XEN Burn Analytics
   - Host: postgres (or your database host)
   - Port: 5432
   - Database Name: xen_burn_analytics
   - Username: postgres (or your database user)
   - Password: postgres (or your database password)

## 3. Creating Dashboards

### Key Metrics Dashboard

Create a new dashboard with the following cards:

1. **Total XEN Burned**
   - SQL Query: `SELECT metric_value FROM analytics WHERE metric_name = 'total_xen_burned'`
   - Visualization: Big Number

2. **Total Burn Positions**
   - SQL Query: `SELECT metric_value FROM analytics WHERE metric_name = 'total_burn_positions'`
   - Visualization: Big Number

3. **Daily Burn Volume**
   - SQL Query: `SELECT metric_value FROM analytics WHERE metric_name = 'daily_xen_burn_volume'`
   - Visualization: Big Number

4. **Claim Rate**
   - SQL Query: `SELECT metric_value FROM analytics WHERE metric_name = 'claim_rate_percentage'`
   - Visualization: Progress Bar (0-100)

5. **Unique Users**
   - SQL Query: `SELECT metric_value FROM analytics WHERE metric_name = 'unique_users'`
   - Visualization: Big Number

6. **Weekly Active Users**
   - SQL Query: `SELECT metric_value FROM analytics WHERE metric_name = 'weekly_active_users'`
   - Visualization: Big Number

7. **Burn Trends (Last 30 Days)**
   - SQL Query: 
     ```sql
     SELECT 
       DATE_TRUNC('day', block_timestamp) AS day,
       SUM(xen_amount_direct + xen_amount_accumulated) AS total_burned
     FROM burn_events
     WHERE event_type = 'XENBurned'
     AND block_timestamp > NOW() - INTERVAL '30 days'
     GROUP BY day
     ORDER BY day
     ```
   - Visualization: Line Chart

8. **Position Count by Lock Period**
   - SQL Query:
     ```sql
     SELECT 
       lock_period_days,
       COUNT(*) AS position_count
     FROM burn_positions
     GROUP BY lock_period_days
     ORDER BY lock_period_days
     ```
   - Visualization: Bar Chart

### User Activity Dashboard

Create a second dashboard with the following cards:

1. **Top Burners**
   - SQL Query:
     ```sql
     SELECT 
       user_address,
       SUM(xen_burned_total) AS total_burned
     FROM burn_positions
     GROUP BY user_address
     ORDER BY total_burned DESC
     LIMIT 10
     ```
   - Visualization: Table

2. **Recent Burn Positions**
   - SQL Query:
     ```sql
     SELECT 
       nft_id,
       user_address,
       xen_burned_total,
       lock_period_days,
       maturity_timestamp,
       status
     FROM burn_positions
     ORDER BY mint_block_timestamp DESC
     LIMIT 10
     ```
   - Visualization: Table

3. **Position Status Distribution**
   - SQL Query:
     ```sql
     SELECT 
       status,
       COUNT(*) AS count
     FROM burn_positions
     GROUP BY status
     ```
   - Visualization: Pie Chart

4. **Emergency Withdrawal Trend**
   - SQL Query:
     ```sql
     SELECT 
       DATE_TRUNC('day', claimed_block_timestamp) AS day,
       COUNT(*) AS withdrawal_count
     FROM burn_positions
     WHERE status LIKE 'emergency_withdrawn%'
     AND claimed_block_timestamp IS NOT NULL
     GROUP BY day
     ORDER BY day
     ```
   - Visualization: Line Chart

## 4. Automated Refreshes

1. Navigate to the Admin Panel > Data Model
2. Find your database and click on it
3. Set up a Scan schedule (e.g., every hour)

## 5. Sharing Dashboards

1. Navigate to the dashboard you want to share
2. Click "Sharing" in the top right
3. Configure public links or embed options as needed

## Troubleshooting

If you encounter issues:

1. Check your database connection settings
2. Verify that the analytics table is being populated by the indexer
3. Restart Metabase if visualizations aren't refreshing properly
4. Check Docker logs: `docker-compose logs metabase` 