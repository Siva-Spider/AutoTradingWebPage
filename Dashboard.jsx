import React, { useState } from "react";
import BrokerRow from "../components/BrokerRow";

const brokerOptions = ["Upstox", "Angel One", "Zerodha", "Groww", "5Paisa"];

export default function Dashboard() {
  const [brokerCount, setBrokerCount] = useState(0);
  const [brokers, setBrokers] = useState([]);

  const handleBrokerChange = (index, value) => {
    const updated = [...brokers];
    updated[index] = { broker: value };
    setBrokers(updated);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top bar with title */}
      <div className="h-[15vh] bg-blue-700 flex items-center justify-center">
        <img src="/astya-logo.png" alt="AstyaProject" className="h-16" />
      </div>

      {/* Broker count selection */}
      <div className="p-6 flex gap-4 items-center">
        <label className="text-lg font-semibold">Number of Brokers:</label>
        <input
          type="number"
          min="0"
          max="5"
          className="border p-2 rounded w-20"
          value={brokerCount}
          onChange={(e) => {
            const count = parseInt(e.target.value || 0);
            setBrokerCount(count);
            setBrokers(Array(count).fill({ broker: "" }));
          }}
        />
      </div>

      {/* Dynamic broker rows */}
      <div className="p-6 space-y-6">
        {Array.from({ length: brokerCount }).map((_, index) => (
          <BrokerRow
            key={index}
            index={index}
            broker={brokers[index]?.broker || ""}
            options={brokerOptions}
            onBrokerChange={handleBrokerChange}
          />
        ))}
      </div>
    </div>
  );
}
