from main import search_item
import os, json

app = Flask(__name__)

@app.route('/api/v1.0/search', methods = ['POST'])
def search ():
    search_list = search_item(itemName, 100)
    return Response(json.dumps(search_list), mimetype='application/json')


if __name__ == '__main__':
    # for deployment
    # to make it work for both production and development
    port = int(os.environ.get("PORT", 6767))
    app.run(debug=True, host='0.0.0.0', port=port)