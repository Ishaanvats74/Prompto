export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const response = await fetch(
      "https://router.huggingface.co/nscale/v1/images/generations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          response_format: "b64_json",
          prompt,
          model: "black-forest-labs/FLUX.1-schnell",
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      return Response.json({ error: data }, { status: response.status });
    }

    return Response.json({
      image: `data:image/png;base64,${data.data[0].b64_json}`,
    });
  } catch (error) {
    return Response.json({ error }, { status: 500 });
  }
}
