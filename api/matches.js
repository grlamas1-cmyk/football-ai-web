export default async function handler(req, res) {
  const API_KEY = process.env.API_FOOTBALL_KEY;

  try {
    const response = await fetch(
      "https://v3.football.api-sports.io/status",
      {
        headers: {
          "x-apisports-key": API_KEY,
        },
      }
    );

    const data = await response.json();

    res.status(200).json({
      ok: true,
      data: data
    });

  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}
