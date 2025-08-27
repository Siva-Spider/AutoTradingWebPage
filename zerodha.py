# backend/app/brokers/zerodha.py
# You would install Zerodha's official SDK, e.g., 'kiteconnect'
# pip install kiteconnect
from kiteconnect import KiteConnect
import logging
import asyncio  # Import asyncio for async operations
from fastapi import HTTPException

# requests is not needed if only using KiteConnect SDK for profile/balance
# import requests

logger = logging.getLogger(__name__)


class ZerodhaBroker:
    # IMPORTANT: In a real application, the API Secret should NOT be hardcoded here.
    # It should be loaded securely from environment variables or a configuration management system.
    # For this example, we'll assume it's set in a config file or passed during setup.
    # ZERODHA_API_SECRET = "YOUR_ZERODHA_API_SECRET_HERE" # You'll need this for generate_session if you were using request_token

    def __init__(self, api_key: str, access_token: str):  # Changed request_token to access_token
        self.api_key = api_key
        self.access_token = access_token  # Store the provided access token
        self.kite = KiteConnect(api_key=self.api_key)
        self.kite.set_access_token(self.access_token)  # Set access token directly
        # self.kite_base_url = "https://api.kite.trade" # For direct API calls if needed

    # The generate_session method is no longer needed if access_token is provided directly.
    # However, for consistency with other brokers and potential future use (e.g., refreshing tokens),
    # we'll keep a simplified version that just confirms the session is set.
    async def generate_session(self):
        """Confirms the Zerodha session is set with the provided access_token."""
        if not self.access_token:
            logger.error("Access token not set for Zerodha.")
            raise HTTPException(status_code=500, detail="Zerodha access token not provided.")

        # In a real application, you might add a lightweight validation call here
        # to ensure the access_token is valid. For now, we'll just confirm it's set.
        logger.info("Zerodha session confirmed with provided access token.")
        await asyncio.sleep(0.1)  # Small async sleep to mimic non-blocking operation
        return True

    async def fetch_profile(self):
        """Fetches user profile details from Zerodha."""
        # Removed the generate_session call here as access_token is provided directly
        # and set in __init__. generate_session() is still called in routes for consistency.

        try:
            profile_raw = await asyncio.to_thread(self.kite.profile)

            logger.info(f"Zerodha Profile: {profile_raw}")
            return {
                "userId": profile_raw.get("user_id"),
                "name": profile_raw.get("user_name"),
                "email": profile_raw.get("email"),
            }
        except Exception as e:
            logger.error(f"Zerodha profile fetch failed: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch Zerodha profile: {e}")

    async def fetch_balance(self):
        """Fetches user equity balance details from Zerodha."""
        # Removed the generate_session call here as access_token is provided directly
        # and set in __init__. generate_session() is still called in routes for consistency.

        try:
            margins_data = await asyncio.to_thread(self.kite.margins, segment="equity")
            equity_data = margins_data.get("equity", {})

            # Formatting balance values
            total_balance = equity_data.get("net", 0.0)
            margin_used = equity_data.get("utilised", {}).get("debits", 0.0)
            available_margin = equity_data.get("available", {}).get("cash", 0.0)

            logger.info(f"Zerodha Balance: {margins_data}")
            return {
                "totalBalance": f"₹ {total_balance:,.2f}",
                "marginUsed": f"₹ {margin_used:,.2f}",
                "availableBalance": f"₹ {available_margin:,.2f}",
            }
        except Exception as e:
            logger.error(f"Zerodha balance fetch failed: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch Zerodha balance: {e}")

