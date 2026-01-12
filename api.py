import os
from flask import Flask, request, jsonify
from client import search_item 

app = Flask(__name__, static_folder=".", static_url_path="")

# Mainly for local development
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
    if data is None:
        return jsonify({"error": "Bad request", "details": "Missing JSON body"}), 400

    query = data.get('query', '')
    minPrice = data.get('minPrice', '0')
    maxPrice = data.get('maxPrice', '')
    if not isinstance(query, str) or not query.strip():
        return jsonify({"error": "Bad request", "details": "Missing query"}), 400

    item_list = search_item(query, minPrice, maxPrice)
    return jsonify({'itemSummaries': item_list})
    
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
