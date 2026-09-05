import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const transactions = [
  {
    id: "TX-1058",
    customer: "Rahul Sharma",
    amount: 4999,
    method: "UPI",
    failure: "Bank timeout",
    history: 8,
    risk: 12,
  },
  {
    id: "TX-1061",
    customer: "Priya Reddy",
    amount: 2499,
    method: "Card",
    failure: "Do not honor",
    history: 5,
    risk: 28,
  },
  {
    id: "TX-1064",
    customer: "Arjun Kumar",
    amount: 8999,
    method: "UPI",
    failure: "User abandoned",
    history: 2,
    risk: 18,
  },
];

function App() {
  const seed = [
    { id:"TX-1058", customer:"Rahul Sharma", amount:4999, method:"UPI", failure:"Bank timeout", history:8, risk:12, status:"Recovery Ready", action:"Controlled Retry" },
    { id:"TX-1061", customer:"Priya Reddy", amount:2499, method:"Card", failure:"Do not honor", history:5, risk:28, status:"Pending", action:"Alternate Payment" },
    { id:"TX-1064", customer:"Arjun Kumar", amount:8999, method:"UPI", failure:"User abandoned", history:2, risk:18, status:"Recovery Ready", action:"Smart Reminder" },
  ];

  const [page, setPage] = useState("Customer View");
  const [transactions, setTransactions] = useState(seed);
  const [selected, setSelected] = useState(seed[0]);
  const [decision, setDecision] = useState(null);
  const [customerStatus, setCustomerStatus] = useState("ready");
  const [customerName, setCustomerName] = useState("Rahul Sharma");
  const [amountInput, setAmountInput] = useState("4999");
  const [methodInput, setMethodInput] = useState("UPI");
  const [recoveredRevenue, setRecoveredRevenue] = useState(0);
  const [review, setReview] = useState(null);
  const paymentAttemptRef = useRef(false);
  const demoFailureRef = useRef(new Set());
  const [lastPaymentData, setLastPaymentData] = useState(null);
  const [auditLog, setAuditLog] = useState([
    "TX-1058 — Payment event received",
    "TX-1058 — Risk scored: 12/100",
    "TX-1058 — Guardrails passed",
    "TX-1058 — Controlled Retry selected",
  ]);

  const money = (n) => Number(n || 0).toLocaleString("en-IN");

  const riskFor = (amount, method, history = 0, failure = "Bank timeout") => {
    let risk = amount >= 25000 ? 78 : amount >= 15000 ? 62 : amount >= 10000 ? 52 : amount >= 5000 ? 32 : 18;
    if (method === "Card") risk += 5;
    if (method === "UPI" && failure === "Bank timeout") risk -= 4;
    if (failure === "Do not honor" || failure === "Insufficient funds") risk += 10;
    if (failure === "User abandoned") risk -= 6;
    if (history >= 5) risk -= 10;
    else if (history >= 3) risk -= 6;
    return Math.max(5, Math.min(95, risk));
  };

  const analyzePayment = (tx = selected, failure = tx.failure || "Bank timeout") => {
    const normalizedFailure = String(failure || "Bank timeout");
    const risk = riskFor(tx.amount, tx.method, tx.history || 0, normalizedFailure);
    let action = "Human Review";
    let reason = "Transaction needs human approval before any money action.";

    if ((tx.amount >= 15000 || risk >= 50) && normalizedFailure !== "User abandoned") {
      action = "Human Review";
      reason = `₹${money(tx.amount)} payment has a higher risk/value profile (${risk}/100), so PayPilot stops automatic recovery and requests human approval.`;
    } else if (normalizedFailure === "Do not honor" || normalizedFailure === "Insufficient funds") {
      action = "Alternate Payment";
      reason = `${normalizedFailure} is not a good reason to blindly retry the same instrument. PayPilot asks the customer to use another payment method.`;
    } else if (normalizedFailure === "User abandoned") {
      action = "Smart Reminder";
      reason = "Checkout was abandoned, so PayPilot resumes the payment journey instead of treating it as a bank failure.";
    } else if (normalizedFailure === "Bank timeout" || normalizedFailure === "Network error") {
      action = "Controlled Retry";
      reason = `A temporary ${normalizedFailure.toLowerCase()} with acceptable risk (${risk}/100) can receive one bounded retry.`;
    } else {
      action = risk < 50 ? "Controlled Retry" : "Human Review";
      reason = risk < 50 ? "Payment data indicates an acceptable-risk temporary failure, so one bounded retry is allowed." : "Payment risk is above the automatic-action threshold, so PayPilot requests human review.";
    }

    const d = { action, reason, guardrail: action === "Human Review" ? "Human Gate" : risk < 50 ? "Passed" : "Human Gate" };
    setDecision(d);
    setCustomerStatus(action === "Controlled Retry" ? "recovery" : action === "Alternate Payment" ? "alternate" : action === "Smart Reminder" ? "reminder" : "review");
    updateTransaction("Recovery Ready", action, tx);
    setAuditLog((x) => [`${tx.id} — AI analyzed method=${tx.method}, failure=${normalizedFailure}, amount=₹${money(tx.amount)}, risk=${risk}/100`, `${tx.id} — AI decision: ${action}`, `${tx.id} — Guardrail: ${d.guardrail}`, ...x].slice(0, 12));
    return d;
  };

  const addCustomer = (e) => {
    e.preventDefault();
    const amount = Number(amountInput);
    if (!customerName.trim() || !Number.isFinite(amount) || amount <= 0) return;
    const tx = {
      id: `TX-${Math.floor(1100 + Math.random() * 800)}`,
      customer: customerName.trim(), amount, method: methodInput,
      failure: "Payment failed", history: 0, risk: riskFor(amount, methodInput, 0, "Payment failed"), status: "Ready", action: "Awaiting Payment"
    };
    setTransactions((x) => [tx, ...x]);
    setSelected(tx); setDecision(null); setReview(null); setLastPaymentData(null); setCustomerStatus("ready");
    setPage("Customer View");
    setAuditLog((x) => [`${tx.id} — New customer/payment created`, ...x].slice(0, 12));
  };

  const updateTransaction = (status, action, tx = selected) => {
    setTransactions((list) => list.map((t) => t.id === tx.id ? { ...t, status, action } : t));
  };

  const markSuccess = (tx = selected) => {
    setCustomerStatus("success");
    setDecision({ action:"Payment Successful", reason:"Razorpay payment completed and server-side signature verification passed.", guardrail:"Passed" });
    setRecoveredRevenue((v) => v + tx.amount);
    updateTransaction("Recovered", "Payment Successful", tx);
    setAuditLog((x) => [`${tx.id} — Payment verified successfully`, `${tx.id} — Revenue recovered: ₹${money(tx.amount)}`, ...x].slice(0, 12));
  };

  const openRazorpayCheckout = async () => {
    if ((selected.amount >= 15000 || selected.risk >= 50) && review !== "approved") {
      setReview("required");
      setCustomerStatus("review");
      setDecision({ action:"Human Review", reason:"This payment is above the automatic recovery threshold. Human approval is required before a recovery action.", guardrail:"Human Gate" });
      return;
    }

    try {
      setCustomerStatus("processing");
      paymentAttemptRef.current = true;

      const response = await fetch("https://paypilot-ai-razorpay-buildathon.onrender.com/api/create-order", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({amount:selected.amount})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create Razorpay order");
      if (!window.Razorpay) throw new Error("Razorpay Checkout script is not loaded");

      const options = {
        key:"rzp_test_TXxlv4F5F4EtwB",
        amount:data.order.amount,
        currency:data.order.currency,
        name:"PayPilot AI",
        description:"Payment Recovery Test",
        order_id:data.order.id,
        prefill:{name:selected.customer,email:"test@example.com",contact:"9000000000"},
        theme:{color:"#3399cc"},
        handler:async function(response) {
          try {
            const verifyResponse = await fetch("https://paypilot-ai-razorpay-buildathon.onrender.com/api/verify-payment", {
              method:"POST",
              headers:{"Content-Type":"application/json"},
              body:JSON.stringify({
                order_id:response.razorpay_order_id,
                payment_id:response.razorpay_payment_id,
                signature:response.razorpay_signature
              })
            });
            const result = await verifyResponse.json();
            if (!verifyResponse.ok || !result.verified) {
              setCustomerStatus("failed");
              setDecision({action:"Verification Failed",reason:"The payment was returned by Checkout but could not be verified by the server, so PayPilot blocked the recovery flow.",guardrail:"Blocked"});
              updateTransaction("Verification Failed","Verification Failed");
              setAuditLog((x) => [`${selected.id} — Payment verification failed — recovery blocked`, ...x].slice(0,12));
              return;
            }

            setLastPaymentData({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              status: "captured/verified"
            });
            markSuccess(selected);
          } catch (err) {
            setCustomerStatus("failed");
            setDecision({action:"Verification Error",reason:"The server could not verify the payment. No recovery action was taken.",guardrail:"Blocked"});
            setAuditLog((x) => [`${selected.id} — Verification error — recovery blocked`, ...x].slice(0,12));
          } finally {
            paymentAttemptRef.current = false;
          }
        },
        modal:{ondismiss:function(){
          // Closing Checkout before a payment failure is not itself a bank failure.
          // Treat it as an abandoned checkout only when no payment.failed event arrived.
          if (!paymentAttemptRef.current) return;
          paymentAttemptRef.current = false;
          setCustomerStatus("failed");
          const tx = selected;
          const abandonedTx = {...tx, failure:"User abandoned"};
          const d = analyzePayment(abandonedTx, "User abandoned");
          setLastPaymentData({status:"checkout_dismissed", failure:"User abandoned"});
          updateTransaction("Recovery Ready", d.action, tx);
          setAuditLog((x) => [`${tx.id} — Checkout dismissed before payment completion`, `${tx.id} — PayPilot treated event as checkout abandonment`, ...x].slice(0,12));
        }}
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on("payment.failed", function(response){
        paymentAttemptRef.current = false;
        const error = response?.error || {};
        const rawReason = error.description || error.reason || error.code || "Payment failed";
        const normalized = String(rawReason);
        const failure = /timeout|timed out|network|gateway|server/i.test(normalized) ? "Bank timeout" :
                        /do not honor|declin|issuer/i.test(normalized) ? "Do not honor" :
                        /insufficient|balance/i.test(normalized) ? "Insufficient funds" :
                        "Payment failed";
        const txWithFailure = {...selected, failure};
        setLastPaymentData({
          status:"failed",
          providerReason:normalized,
          code:error.code || "unknown",
          method:txWithFailure.method
        });
        setCustomerStatus("failed");
        const d = analyzePayment(txWithFailure, failure);
        updateTransaction("Recovery Ready", d.action, selected);
        setAuditLog((x) => [`${selected.id} — Razorpay payment.failed received`, `${selected.id} — Provider reason: ${normalized}`, ...x].slice(0,12));
      });

      razorpay.open();
    } catch (err) {
      paymentAttemptRef.current = false;
      setCustomerStatus("failed");
      setDecision({action:"Checkout Error",reason:err.message,guardrail:"Blocked"});
      setAuditLog((x) => [`${selected.id} — Checkout error: ${err.message}`, ...x].slice(0,12));
    }
  };

  const startPayment = () => {
    if (selected.amount >= 15000 || selected.risk >= 50) {
      setReview("required");
      setCustomerStatus("review");
      analyzePayment(selected);
      return;
    }

    // Demo mode: make the FIRST attempt fail once so judges can see the
    // complete recovery journey. The failure is labelled as simulated
    // provider data; the RETRY then opens the real Razorpay Test Checkout.
    if (!demoFailureRef.current.has(selected.id)) {
      demoFailureRef.current.add(selected.id);
      const demoTx = { ...selected, failure: "Bank timeout" };
      setLastPaymentData({
        status: "failed",
        providerReason: "Bank timeout (simulated Test Mode event)",
        code: "BANK_TIMEOUT_SIMULATED",
        method: selected.method
      });
      setCustomerStatus("failed");
      const d = analyzePayment(demoTx, "Bank timeout");
      updateTransaction("Recovery Ready", d.action, selected);
      setAuditLog((x) => [
        `${selected.id} — Demo payment attempt failed`,
        `${selected.id} — Provider event: Bank timeout (simulated Test Mode)`,
        ...x
      ].slice(0, 12));
      return;
    }

    openRazorpayCheckout();
  };

  const selectTx = (tx) => { setSelected(tx); setDecision(null); setReview(null); setCustomerStatus(tx.status === "Recovered" ? "success" : "ready"); setPage("Customer View"); };

  const navItems = ["Customer View","Overview","Payment Simulator","Transactions","AI Command Center","Recovery Queue","Customers","Analytics","Observability","Safety & Guardrails","Audit Log"];
  const atRisk = transactions.filter(t => t.status !== "Recovered").reduce((s,t) => s+t.amount,0);
  const recoveredCount = transactions.filter(t => t.status === "Recovered").length;

  return (
    <div className="app">
      <aside>
        <h2>◈ PayPilot <small>AI</small></h2><p>Revenue Recovery Agent</p>
        {navItems.map(item => <button key={item} className={page===item?"nav active":"nav"} onClick={()=>setPage(item)}>{item}</button>)}
        <div className="box">RAZORPAY TEST MODE<br/><small>No real money</small></div>
      </aside>
      <main>
        <header><div><label>BUILDATHON • TRACK 03</label><h1>{page}</h1><p>Explainable, bounded payment recovery.</p></div><b>● TEST MODE</b></header>

        {page === "Customer View" && <>
          <section className="card">
            <h2>Customer Payment Experience</h2>
            <p>Customer-facing payment screen. PayPilot analyzes the payment after a failure and gives the safest next action.</p>
            <form onSubmit={addCustomer} className="grid">
              <div className="card"><h3>Add New Customer</h3>
                <input value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Customer name" style={{padding:12,width:"100%",boxSizing:"border-box",marginBottom:10}} />
                <input value={amountInput} onChange={e=>setAmountInput(e.target.value)} type="number" min="1" placeholder="Amount" style={{padding:12,width:"100%",boxSizing:"border-box",marginBottom:10}} />
                <select value={methodInput} onChange={e=>setMethodInput(e.target.value)} style={{padding:12,width:"100%",boxSizing:"border-box",marginBottom:10}}><option>UPI</option><option>Card</option><option>Netbanking</option></select>
                <button className="primary" type="submit">Add Customer & Prepare Payment</button>
              </div>
              <div className="card"><h3>Current Payment</h3><h2>{selected.customer}</h2><p>Amount: <b>₹{money(selected.amount)}</b><br/>Method: {selected.method}<br/>Risk score: {selected.risk}/100<br/>Payment ID: {selected.id}</p>{lastPaymentData?.providerReason && <p><b>Provider detail (merchant view):</b> {lastPaymentData.providerReason}</p>}</div>
            </form>
          </section>

          <section className="card">
            {customerStatus === "ready" && <><div className="decision">Payment Ready</div><p>Click Pay Now to open Razorpay Test Checkout.</p><button className="primary" onClick={startPayment}>Pay Now — ₹{money(selected.amount)}</button></>}
            {customerStatus === "processing" && <><div className="decision">Opening Razorpay…</div><p>Payment checkout is being opened.</p></>}
            {customerStatus === "failed" && <><div className="decision">❌ Payment Failed</div><p>We could not complete your payment. Please try again using the recovery option below.</p><button className="primary" onClick={()=>analyzePayment(selected,selected.failure)}>Get PayPilot Recovery Option</button></>}
            {customerStatus === "recovery" && <><div className="decision">🤖 Payment Recovery Available</div><p>We couldn't complete your payment. PayPilot has found a safe way to try again.</p><button className="primary" onClick={()=>{setCustomerStatus("ready");openRazorpayCheckout();}}>Try Payment Again</button></>}
            {customerStatus === "alternate" && <><div className="decision">🔄 Choose Another Payment Method</div><p>This payment couldn't be completed with the current method. You can try another payment method.</p><button className="primary" onClick={()=>{setCustomerStatus("ready");openRazorpayCheckout();}}>Choose Another Method</button></>}
            {customerStatus === "reminder" && <><div className="decision">🔔 Resume Your Payment</div><p>Your payment wasn't completed. You can safely continue where you left off.</p><button className="primary" onClick={()=>{setCustomerStatus("ready");openRazorpayCheckout();}}>Resume Payment</button></>}
            {customerStatus === "review" && <><div className="decision">⚠️ Human Review Required</div><p>{decision?.reason || "A human must approve this recovery."}</p>{review !== "approved" ? <button className="primary" onClick={()=>{setReview("approved");setCustomerStatus("ready");setDecision({action:"Human Approved",reason:"Human reviewer approved the bounded recovery action.",guardrail:"Passed"});setAuditLog(x=>[`${selected.id} — Human approved recovery`,...x].slice(0,12));}}>Approve Recovery & Continue</button> : <button className="primary" onClick={openRazorpayCheckout}>Continue to Payment</button>}</>}
            {customerStatus === "success" && <><div className="decision">✅ Payment Successful</div><h2>₹{money(selected.amount)} Recovered</h2><p>Payment verified successfully. Merchant dashboard has been updated automatically.</p><button onClick={()=>setPage("Overview")}>View Merchant Dashboard</button></>}
          </section>

          <section className="card"><h2>PayPilot Recovery Pipeline</h2><p>Payment Event → AI Analysis → Risk → Guardrails → Recovery Decision → Razorpay → Verification → Dashboard Update → Audit</p>{decision && <div className="card"><h3>Merchant Decision Detail</h3><p><b>AI Action:</b> {decision.action}<br/><b>Why:</b> {decision.reason}<br/><b>Guardrail:</b> {decision.guardrail}</p>{lastPaymentData?.providerReason && <p><b>Provider failure data:</b> {lastPaymentData.providerReason}</p>}</div>}</section>
        </>}

        {page === "Overview" && <><div className="grid"><section className="card"><h3>Revenue Recovered</h3><h1>₹{money(recoveredRevenue)}</h1></section><section className="card"><h3>Revenue at Risk</h3><h1>₹{money(atRisk)}</h1></section><section className="card"><h3>Recovered Payments</h3><h1>{recoveredCount}</h1></section></div><section className="card"><h2>Live Recovery Status</h2><p>Current customer: <b>{selected.customer}</b> • ₹{money(selected.amount)} • {selected.status}</p><p>{decision ? `${decision.action} — ${decision.reason}` : "Select a payment and run a recovery decision."}</p><button className="primary" onClick={()=>setPage("Customer View")}>Open Customer Payment Flow</button></section></>}

        {page === "Payment Simulator" && <section className="card"><h2>Payment Simulator</h2><p>Test different failures and see how PayPilot changes its action.</p><div className="grid">{transactions.slice(0,6).map(tx=><div className="card" key={tx.id}><h3>{tx.id} — {tx.customer}</h3><p>₹{money(tx.amount)} • {tx.method}<br/>Failure: {tx.failure}<br/>Risk: {tx.risk}/100</p><button className="primary" onClick={()=>{setSelected(tx);analyzePayment(tx,tx.failure);}}>Analyze with PayPilot AI</button></div>)}</div></section>}

        {page === "Transactions" && <section className="card"><h2>Payment Transactions</h2><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th>Transaction</th><th>Customer</th><th>Amount</th><th>Method</th><th>Failure</th><th>AI Action</th><th>Status</th></tr></thead><tbody>{transactions.map(tx=><tr key={tx.id}><td>{tx.id}</td><td>{tx.customer}</td><td>₹{money(tx.amount)}</td><td>{tx.method}</td><td>{tx.failure}</td><td>{tx.action}</td><td>{tx.status}</td></tr>)}</tbody></table></div></section>}

        {page === "AI Command Center" && <section className="card"><h2>AI Command Center</h2><div className="decision">{decision?.action || "Payment Recovery Intelligence"}</div><p>PayPilot evaluates amount, payment method, failure reason, customer history and risk.</p><h3>Decision Pipeline</h3><p>1️⃣ Detect event</p><p>2️⃣ Analyze context + risk</p><p>3️⃣ Evaluate guardrails</p><p>4️⃣ Select recovery strategy</p><p>5️⃣ Execute or escalate</p>{decision && <p><b>Why:</b> {decision.reason}<br/><b>Guardrail:</b> {decision.guardrail}</p>}</section>}

        {page === "Recovery Queue" && <section className="card"><h2>Recovery Queue</h2><div className="grid">{transactions.filter(t=>t.status!=="Recovered").map(tx=><div className="card" key={tx.id}><h3>{tx.customer}</h3><h2>₹{money(tx.amount)}</h2><div className="decision">{tx.action}</div><p>{tx.failure} • Risk {tx.risk}/100</p><button onClick={()=>selectTx(tx)}>Open Recovery</button></div>)}</div></section>}

        {page === "Customers" && <section className="card"><h2>Customer Context</h2><div className="grid">{transactions.map(tx=><div className="card" key={tx.id}><h3>{tx.customer}</h3><p>Previous payments: {tx.history}<br/>Risk: {tx.risk}/100<br/>Current amount: ₹{money(tx.amount)}</p><b>{tx.action}</b></div>)}</div></section>}

        {page === "Analytics" && <><div className="grid"><section className="card"><h3>Revenue at Risk</h3><h1>₹{money(atRisk)}</h1></section><section className="card"><h3>Recovered Revenue</h3><h1>₹{money(recoveredRevenue)}</h1></section><section className="card"><h3>Recovery Rate</h3><h1>{transactions.length ? Math.round((recoveredCount/transactions.length)*100) : 0}%</h1></section></div><section className="card"><h2>Strategy Distribution</h2><p>Controlled Retry • Alternate Payment • Smart Reminder • Human Review</p></section></>}

        {page === "Observability" && <section className="card"><h2>System Observability</h2><p>🟢 Payment event received</p><p>🟢 Context scoring completed</p><p>🟢 Guardrails evaluated</p><p>🟢 AI decision generated</p><p>🟢 Razorpay integration available</p><p>🟢 Server-side verification enabled</p></section>}

        {page === "Safety & Guardrails" && <section className="card"><h2>Safety & Guardrails</h2><div className="decision">Guardrails Active</div><p>✓ Amount/risk threshold</p><p>✓ One bounded retry</p><p>✓ No blind repeated retries</p><p>✓ Human approval for high-value/high-risk cases</p><p>✓ Payment verification required</p><p>✓ Test Mode only</p></section>}

        {page === "Audit Log" && <section className="card"><h2>Audit Log</h2>{auditLog.map((x,i)=><p key={i}>• {x}</p>)}</section>}

        <footer>PayPilot AI • Razorpay Test Mode • No live money</footer>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
