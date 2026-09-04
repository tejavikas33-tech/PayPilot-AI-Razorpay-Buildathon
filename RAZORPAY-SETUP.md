# Razorpay Test Mode Setup
1. Run `npm install`.
2. Copy `.env.example` to `.env`.
3. Put your NEW Razorpay TEST Key ID and Key Secret in `.env`. Never share `.env`.
4. Start backend: `node server/server.js`.
5. Check `http://localhost:5000/api/health`.
6. PowerShell test: `Invoke-RestMethod -Uri http://localhost:5000/api/create-order -Method POST -ContentType "application/json" -Body '{"amount":4999}'`
7. CMD alternative: `curl -X POST http://localhost:5000/api/create-order -H "Content-Type: application/json" -d "{\"amount\":4999}"`
8. Start frontend in another terminal: `npm run dev`.
9. Payment Simulator includes Create Razorpay Test Order.
10. Optional webhook: configure a public HTTPS `/api/webhook` in Razorpay Test Mode and use the same webhook secret in `.env`.
11. Test Mode does not move real money. Do not claim PayPilot processes payments; it makes bounded recovery decisions.
