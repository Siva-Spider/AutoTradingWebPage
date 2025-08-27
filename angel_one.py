# backend/app/brokers/angel_one.py
# You would install Angel One's official SDK, e.g., 'smartapi-python'
# pip install smartapi-python pyotp
from SmartApi import SmartConnect
import pyotp  # Import pyotp for TOTP generation
import logging
import asyncio  # Import asyncio for async operations
from fastapi import HTTPException

logger = logging.getLogger(__name__)


class AngelOneBroker:
    def __init__(self, api_key: str, client_code: str, pin: str, totp_secret: str):
        self.api_key = api_key
        self.client_code = client_code
        self.pin = pin
        self.totp_secret = totp_secret
        self.smart_api = SmartConnect(api_key=self.api_key)
        self.refresh_token = None
        self.feed_token = None  # Often returned with login, but not strictly used for profile/balance

    async def generate_session(self):
        """Generates an Angel One session (refresh_token) using credentials and TOTP."""
        try:
            # Generate TOTP
            totp_value = pyotp.TOTP(self.totp_secret).now()
            logger.info(f"Generated TOTP for Angel One: {totp_value}")

            # Execute the synchronous generateSession call in a separate thread
            login_response = await asyncio.to_thread(
                self.smart_api.generateSession, self.client_code, self.pin, totp_value
            )

            logger.info(f"Angel One Login Response: {login_response}")

            if login_response and login_response.get('status') == True and 'data' in login_response:
                self.refresh_token = login_response['data']['refreshToken']
                # The SDK might set the access token internally or require it for subsequent calls.
                # For profile/balance, refresh_token is often key.
                # self.smart_api.set_access_token(login_response['data']['jwtToken']) # if needed for direct token usage
                logger.info("Angel One session generated successfully.")
                return True
            else:
                detail = login_response.get('message', 'Failed to generate session')
                raise HTTPException(status_code=401, detail=f"Angel One Login failed: {detail}")
        except HTTPException:
            raise  # Re-raise FastAPI HTTPExceptions
        except Exception as e:
            logger.error(f"Angel One session generation failed: {e}", exc_info=True)
            raise HTTPException(status_code=500,
                                detail=f"Failed to generate Angel One session due to internal error: {e}")

    async def fetch_profile(self):
        """Fetches user profile details from Angel One."""
        if not self.refresh_token:
            await self.generate_session()  # Attempt to generate session if not available

        try:
            # Execute the synchronous getProfile call in a separate thread
            profile_res = await asyncio.to_thread(self.smart_api.getProfile, self.refresh_token)
            data_profile = profile_res['data']
            logger.info(f"Angel One Profile: {data_profile}")

            return {
                "userId": data_profile.get('clientcode', 'N/A'),
                "name": data_profile.get('name', 'N/A'),
                "email": data_profile.get('email', 'N/A'),
            }
        except Exception as e:
            logger.error(f"Angel One profile fetch failed: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to fetch Angel One profile: {e}")

    async def fetch_balance(self):
        """Fetches user balance details from Angel One."""
        if not self.refresh_token:
            await self.generate_session()  # Attempt to generate session if not available

        try:
            # Execute the synchronous rmsLimit call in a separate thread
            balance_res = await asyncio.to_thread(self.smart_api.rmsLimit)
            data_balance = balance_res['data']
            logger.info(f"Angel One Balance: {data_balance}")

            # Convert values to float before formatting to avoid ValueError
            total_balance_str = data_balance.get('net', '0.0')
            available_limit_margin_str = data_balance.get('availablelimitmargin', '0.0')

            # Safely convert to float, handle potential errors if API returns non-numeric strings
            try:
                total_balance = float(total_balance_str)
                available_limit_margin = float(available_limit_margin_str)
            except ValueError:
                logger.error(
                    f"Failed to convert balance string to float: net='{total_balance_str}', availablelimitmargin='{available_limit_margin_str}'")
                raise HTTPException(status_code=500, detail="Angel One balance data is in an unexpected format.")

            # Angel One 'rmsLimit' might not directly give 'marginUsed', calculate it
            margin_used = total_balance - available_limit_margin if total_balance > available_limit_margin else 0.0

            return {
                "totalBalance": f"₹ {total_balance:,.2f}",
                "marginUsed": f"₹ {margin_used:,.2f}",
                "availableBalance": f"₹ {available_limit_margin:,.2f}",
            }
        except HTTPException:
            raise  # Re-raise FastAPI HTTPExceptions
        except Exception as e:
            logger.error(f"Angel One balance fetch failed: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to fetch Angel One balance: {e}")

