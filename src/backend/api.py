import sys
import os

# This line tells Python to look in the current folder for main.py
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import search_item 
from flask import Flask, request, jsonify

app = Flask(__name__)


@app.route('/api/debug-files')
def debug_files():
    # Get the current working directory of the serverless function
    cwd = os.getcwd()
    
    # List all files and folders in the current directory
    try:
        files = os.listdir(cwd)
        # Also check the specific folder where this file lives
        script_dir = os.path.dirname(os.path.abspath(__file__))
        script_dir_files = os.listdir(script_dir)
        
        return jsonify({
            "current_working_directory": cwd,
            "files_in_cwd": files,
            "directory_of_api_py": script_dir,
            "files_in_api_py_folder": script_dir_files,
            "env_check": {
                "EBAY_CLIENT_ID_EXISTS": "EBAY_CLIENT_ID" in os.environ,
                "VERCEL_ENV": os.environ.get('VERCEL_ENV', 'not-found')
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)})

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