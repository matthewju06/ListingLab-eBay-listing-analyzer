import os
from flask import Blueprint, request, jsonify, render_template
from .clients import search_item 

bp = Blueprint('main', __name__)

# Mainly for local development
@bp.route("/")
def index():
    return render_template("index.html")

@bp.route('/api/search', methods = ['POST', 'OPTIONS']) 
def search():
    if request.method == "OPTIONS":
        return ("", 204) 

    data = request.get_json()
    if not data:
        return jsonify({"error": "Bad request", "details": "Missing JSON body"}), 400

    query = data.get('query', '')
    minPrice = data.get('minPrice', '0')
    maxPrice = data.get('maxPrice', '')

    if not isinstance(query, str) or not query.strip():
        return jsonify({"error": "Bad request", "details": "Missing query"}), 400

    item_list = search_item(query, minPrice, maxPrice)
    return jsonify({'itemSummaries': item_list})