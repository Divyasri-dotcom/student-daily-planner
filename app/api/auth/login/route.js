export async function POST(request) {
  const body = await request.json()

  const user = {
    id: 1,
    email: body.email
  }

  return Response.json({
    message: 'Login successful',
    user
  })
}
