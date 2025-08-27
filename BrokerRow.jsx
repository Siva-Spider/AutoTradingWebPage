import React from "react";
import BrokerForm from "./BrokerForm";

export default function BrokerRow({ index, broker, options, onBrokerChange }) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow">
      <label className="block mb-2 font-semibold">Select Broker:</label>
      <select
        className="border p-2 rounded w-60"
        value={broker}
        onChange={(e) => onBrokerChange(index, e.target.value)}
      >
        <option value="">-- Select --</option>
        {options.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>

      <div className="mt-4">
        {broker && <BrokerForm broker={broker} />}
      </div>
    </div>
  );
}
