// Simple fetch wrapper for backend communication

export async function extractText(data: FormData | { text: string }) {
  const response = await fetch("http://localhost:5000/api/extract", {
    method: "POST",
    body: data instanceof FormData ? data : JSON.stringify(data),
    headers: data instanceof FormData ? undefined : { "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error("Extraction failed.");
  return response.json();
}

// Add other API methods as needed (save graph, get graph, etc)