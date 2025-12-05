export function handleError(e: any) {
  console.error("API Error:", e)

  return new Response(
    JSON.stringify({
      success: false,
      message: "An unexpected error occurred.",
      error: e?.message,
    }),
    { status: 500, headers: { "Content-Type": "application/json" } },
  )
}
