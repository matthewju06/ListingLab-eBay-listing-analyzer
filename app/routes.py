import os
from flask import Blueprint, request, jsonify, render_template
from .services import get_items #routes -> services

bp = Blueprint('main', __name__)

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
    minPrice = data.get('minPrice', '')
    maxPrice = data.get('maxPrice', '')
    category = data.get('category', None)
    condition = data.get('condition', None)
    filterStrength = data.get('filterStrength', 0)

    if not isinstance(query, str) or not query.strip():
        return jsonify({"error": "Bad request", "details": "Missing query"}), 400

    item_list = get_items(query, minPrice, maxPrice, category, condition, filterStrength)
    return jsonify({'itemSummaries': item_list})