import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();

app.use(cors());

let gaugeCache = [];

function getFloodStatus(level, gauge) {
  if (level >= gauge.major) return "Major";
  if (level >= gauge.moderate) return "Moderate";
  if (level >= gauge.minor) return "Minor";
  return "Normal";
}

async function discoverGauges() {
  return [
    {
      id: "041499",
      name: "Condamine River at Tummaville",
      catchment: "Condamine-Balonne",
      url: "https://www.bom.gov.au/fwo/IDQ65396/IDQ65396.041499.plt.shtml",
      lat: -27.9,
      lon: 151.4,
      minor: 5,
      moderate: 8,
      major: 9
    }
  ];
}

async function discoverGauges() {
  const discovered = new Map();

  const seedPages = [
    "https://www.bom.gov.au/qld/flood/",
    "https://www.bom.gov.au/fwo/"
  ];

  for (const page of seedPages) {
    try {
      const response = await axios.get(page, {
        timeout: 30000
      });

      const $ = cheerio.load(response.data);

      $("a").each((_, el) => {
        const href = $(el).attr("href") || "";

        const match = href.match(
          /([A-Z]{3}\d+)\.(\d{6})\.plt\.shtml/i
        );

        if (!match) return;

        const stationId = match[2];

        if (!discovered.has(stationId)) {
          discovered.set(stationId, {
            id: stationId,
            url: new URL(href, page).href
          });
        }
      });
    } catch (err) {
      console.error(
        "Discovery error:",
        err.message
      );
    }
  }

  return [...discovered.values()];
}
async function enrichGauge(gauge) {
  try {
    const response = await axios.get(gauge.url);

    const $ = cheerio.load(response.data);

    const heading =
      $("h1").first().text().trim() ||
      $("title").text().trim();

    gauge.name = heading;

    const pageText = $("body").text();

    const latMatch =
      pageText.match(/Latitude[^-0-9]*(-?\d+\.\d+)/i);

    const lonMatch =
      pageText.match(/Longitude[^0-9]*(\d+\.\d+)/i);

    if (latMatch && lonMatch) {
      gauge.lat = parseFloat(latMatch[1]);
      gauge.lon = parseFloat(lonMatch[1]);
    }

    return gauge;
  } catch (err) {
    console.error(
      "Metadata error:",
      gauge.id,
      err.message
    );

    return gauge;
  }
}
