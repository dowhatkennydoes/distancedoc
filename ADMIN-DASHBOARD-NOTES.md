# Admin Dashboard - Implementation Notes

## Chart Library

The dashboard currently uses CSS/SVG-based chart implementations that work immediately without additional dependencies. For production-grade charts with more features, consider installing Recharts:

```bash
npm install recharts
```

Then you can replace the `SimpleLineChart` and `SimpleBarChart` components with Recharts components for:

- Better interactivity
- Tooltips on hover
- Legend support
- More chart types
- Better responsive behavior
- Data zooming

## Current Implementation

The current charts use:
- **Line Chart**: SVG-based with manual grid lines, points, and labels
- **Bar Chart**: CSS-based with flexbox layout and height animations

Both work well for basic visualizations and require zero dependencies.

## Mock Data

Currently, the dashboard uses mock data. Replace the data fetching in `useEffect` with actual API calls:

```tsx
// Replace this section:
const fetchMetrics = async () => {
  try {
    // TODO: Replace with actual API calls
    const response = await fetch("/api/admin/metrics")
    const data = await response.json()
    setMetrics(data)
  } catch (error) {
    console.error("Failed to fetch metrics:", error)
  }
}
```

## API Endpoints Needed

Create these API endpoints under `/app/api/admin/`:

1. **GET `/api/admin/metrics`** - Returns key metrics
2. **GET `/api/admin/appointments-over-time`** - Returns appointment time series
3. **GET `/api/admin/patient-registrations`** - Returns patient registration data
4. **GET `/api/admin/recent-logins`** - Returns recent login attempts
5. **GET `/api/admin/doctor-activity`** - Returns doctor activity feed
6. **GET `/api/admin/system-events`** - Returns system events

All endpoints should:
- Require admin role authentication
- Include proper error handling
- Support pagination/limits
- Return properly formatted JSON

