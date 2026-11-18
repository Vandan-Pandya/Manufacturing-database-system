import http.server
import socketserver
import os
import json
import urllib.parse
from dotenv import load_dotenv

import db

PORT = 3000

class ProductionERPHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def send_json(self, data, status_code=200):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            if length > 0:
                raw_body = self.rfile.read(length).decode('utf-8')
                return json.loads(raw_body)
        except Exception as e:
            print("Failed to read JSON body:", e)
        return {}

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/')

        if path == '/api/status':
            status = db.test_connection()
            return self.send_json(status)

        if path == '/api/data':
            try:
                data = db.get_all_data()
                return self.send_json(data)
            except Exception as e:
                return self.send_json({"error": str(e)}, status_code=500)

        if path.startswith('/api/'):
            parts = [p for p in path.split('/') if p]
            # /api/<entity>
            if len(parts) == 2:
                entity = parts[1]
                try:
                    data = db.get_entity_data(entity)
                    return self.send_json(data)
                except Exception as e:
                    return self.send_json({"error": str(e)}, status_code=500)

        # Fallback to standard static file serving
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/')

        if path == '/api/config':
            body = self.read_json_body()
            db_pass = body.get('password')
            db_name = body.get('database')
            db_user = body.get('user')
            
            # Update .env
            env_path = os.path.join(os.path.dirname(__file__), '.env')
            lines = []
            if os.path.exists(env_path):
                with open(env_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
            
            config_dict = {}
            for line in lines:
                if '=' in line:
                    k, v = line.strip().split('=', 1)
                    config_dict[k] = v

            if db_pass is not None:
                config_dict['DB_PASSWORD'] = db_pass
                os.environ['DB_PASSWORD'] = db_pass
                db.DB_PASSWORD = db_pass
            if db_name:
                config_dict['DB_NAME'] = db_name
                os.environ['DB_NAME'] = db_name
                db.DB_NAME = db_name
            if db_user:
                config_dict['DB_USER'] = db_user
                os.environ['DB_USER'] = db_user
                db.DB_USER = db_user

            with open(env_path, 'w', encoding='utf-8') as f:
                for k, v in config_dict.items():
                    f.write(f"{k}={v}\n")

            status = db.test_connection()
            return self.send_json(status)

        if path.startswith('/api/'):
            parts = [p for p in path.split('/') if p]
            if len(parts) == 2:
                entity = parts[1]
                body = self.read_json_body()
                try:
                    res = db.create_record(entity, body)
                    return self.send_json(res, status_code=201)
                except Exception as e:
                    return self.send_json({"error": str(e)}, status_code=500)

        self.send_error(404, "Endpoint not found")

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/')

        if path.startswith('/api/'):
            parts = [p for p in path.split('/') if p]
            # /api/<entity>/<id>
            if len(parts) == 3:
                entity = parts[1]
                id_val = parts[2]
                body = self.read_json_body()
                try:
                    res = db.update_record(entity, id_val, body)
                    return self.send_json(res)
                except Exception as e:
                    return self.send_json({"error": str(e)}, status_code=500)

        self.send_error(404, "Endpoint not found")

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/')

        if path.startswith('/api/'):
            parts = [p for p in path.split('/') if p]
            # /api/<entity>/<id>
            if len(parts) == 3:
                entity = parts[1]
                id_val = parts[2]
                try:
                    success = db.delete_record(entity, id_val)
                    return self.send_json({"success": success})
                except Exception as e:
                    return self.send_json({"error": str(e)}, status_code=500)

        self.send_error(404, "Endpoint not found")

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f"Connecting to database '{db.DB_NAME}' as user '{db.DB_USER}'...")
    with socketserver.TCPServer(("", PORT), ProductionERPHandler) as httpd:
        print(f"Serving ERP System at http://localhost:{PORT} (PostgreSQL API Enabled)")
        httpd.serve_forever()
