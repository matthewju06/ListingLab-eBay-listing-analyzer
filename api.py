import sys
import os
from flask import Flask, request, jsonify

# This line tells Python to look in the current folder for main.py
api_dir = os.path.dirname(os.path.abspath(__file__))
if api_dir not in sys.path:
    sys.path.append(api_dir)
from main import search_item 

app = Flask(__name__, static_folder=".", static_url_path="")

@app.route("/")
def index():
    return app.send_static_file("index.html")

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
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8000))
    app.run(debug=True, host='0.0.0.0', port=port)