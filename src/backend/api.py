import sys
import os

# Get the absolute path to the folder containing api.py (src/backend)
current_dir = os.path.dirname(os.path.abspath(__file__))

# Add this directory to the Python path if it's not already there
if current_dir not in sys.path:
    sys.path.append(current_dir)

# NOW try importing from main.py
try:
    from main import search_item
    print("Successfully imported search_item from main.py")
except ImportError as e:
    print(f"FAILED to import main.py: {e}")

# This line tells Python to look in the current folder for main.py
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import search_item 
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/api/search', methods = ['POST', 'OPTIONS']) 
def search(): # -> json form of dict
    #input eg -> {query: "pokemon"}
    if request.method == "OPTIONS":
        return ("", 204)  # preflight OK

    # if request.is_json:
    data = request.get_json()
    query = data.get('query')
    item_list = search_item(query)
    # Send back to JS
    return jsonify({'itemSummaries': item_list})
    # else:
    #     #get form-encoded data
    #     query = request.form.get('query')
    #     item_list = search_item(query)
    #     return jsonify({'itemSummaries': item_list})
    
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"   # dev only
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    return response

# Uncomment for local deployment
# if __name__ == '__main__':
#     port = int(os.environ.get("PORT", 6767))
#     app.run(debug=True, host='0.0.0.0', port=port)