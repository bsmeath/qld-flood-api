import express from "express";
import cors from "cors";

const app = express();

app.use(cors());

const PORT = process.env.PORT || 3001;

let gaugeCache = [
  {
    id: "041499",
    name: "Condamine River at Tummaville",
    catchment: "Condamine-Balonne",
    level: 9.8,
    status: "Major",
    lat: -27.9,
    lon: 151.4,
    history: [
      { timestamp: "2026-10-27 08:00", level: 9.8 },
      { timestamp: "2026-10-27 07:00", level: 9.6 }
    ]
  },
  {
    id: "540001",
    name: "Brisbane River",
    catchment: "Brisbane",
    level: 4.2,
    status: "Minor",
    lat: -27.47,
    lon: 153.03,
    history: [
      { timestamp: "2026-10-27 08:00", level: 4.2 },
      { timestamp: "2026-10-27 07:00", level: 4.1 }
    ]
  },
  {
    id: "130003",
    name: "Fitzroy River",
    catchment: "Fitzroy",
    level: 7.1,
    status: "Moderate",
    lat: -23.38,
    lon: 150.51,
    history: [
      { timestamp: "2026-10-27 08:00", level: 7.1 },
      { timestamp: "2026-10-27 07:00", level: 6.9 }
    ]
  }
];

let lastRefresh = new Date().toISOString();

app.get("/api/status", (req, res) => {
  res.json({
    status: "online",
    gauges: gaugeCache.length,
    discovered: gaugeCache.length,
    updated: lastRefresh
  });
});

app.get("/api/gauges", (req, res) => {
  res.json(gaugeCache);
});

app.get("/api/gauges/:id", (req, res) => {
  const gauge = gaugeCache.find(
    g => g.id === req.params.id
  );

  if (!gauge) {
    return res.status(404).json({
      error: "Gauge not found"
    });
  }

  res.json(gauge);
});

app.listen(PORT, () => {
  console.log(
    `QLD Flood API listening on ${PORT}`
  );
});
