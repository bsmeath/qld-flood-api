import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();

app.use(cors());

const PORT = process.env.PORT || 3001;

app.get("/api/debug", async (req, res) => {

  try {

    const url =
      "https://www.bom.gov.au/qld/flood/networks/rv_stn.kmz";

    const response =
      await axios.get(url, {
        responseType: "arraybuffer"
      });

    res.json({
      size:
        response.data.length,
      contentType:
        response.headers["content-type"],
      status:
        response.status
    });

  } catch (err) {

    res.status(500).json({
      status:
        err.response?.status,
      message:
        err.message
    });

  }

});

app.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});
