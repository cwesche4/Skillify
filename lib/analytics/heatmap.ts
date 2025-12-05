"use client"

export function recordInteraction(key: string) {
  const data = JSON.parse(localStorage.getItem("skillify-heatmap") ?? "{}")

  data[key] = (data[key] ?? 0) + 1

  localStorage.setItem("skillify-heatmap", JSON.stringify(data))
}

export function getHeatmap() {
  return JSON.parse(localStorage.getItem("skillify-heatmap") ?? "{}")
}
