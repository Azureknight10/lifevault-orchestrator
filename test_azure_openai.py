from openai import AzureOpenAI
from dotenv import load_dotenv
import os

print("CWD:", os.getcwd())
print(".env exists:", os.path.exists(".env"))

# Load environment variables from .env in this folder
load_dotenv()

print("API_VERSION:", os.getenv("AZURE_OPENAI_API_VERSION"))

client = AzureOpenAI(
    api_version=os.environ["AZURE_OPENAI_API_VERSION"],
    api_key=os.environ["AZURE_OPENAI_API_KEY"],
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
)

response = client.chat.completions.create(
    model=os.environ["AZURE_OPENAI_DEPLOYMENT_NAME"],
    messages=[{"role": "user", "content": "Say hello from Azure GPT-4o-mini"}],
)

print(response.choices[0].message.content)

from openai import AzureOpenAI
from dotenv import load_dotenv
import os

# Load environment variables from .env in this folder
load_dotenv()

client = AzureOpenAI(
    api_version=os.environ["AZURE_OPENAI_API_VERSION"],
    api_key=os.environ["AZURE_OPENAI_API_KEY"],
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
)

response = client.chat.completions.create(
    model=os.environ["AZURE_OPENAI_DEPLOYMENT_NAME"],
    messages=[{"role": "user", "content": "Say hello from Azure GPT-4o-mini"}],
)

print(response.choices[0].message.content)