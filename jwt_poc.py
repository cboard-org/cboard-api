import jwt
private_key = None
with open("./private.key", mode="rb") as pk_file:
    private_key = pk_file.read()
payload = {
  "data1": 'Data 1',
  "data2": 'Data 2',
  "data3": 'Data 3',
  "data4": 'Data 4',
  "iat": 1650116283,
  "exp": 1650159483,
  "aud": 'http://localhost:8080',
  "iss": 'RESTORE-Skills',
  "sub": 'user@restoreskills.com'
}

token = jwt.encode(payload, private_key, algorithm="RS256")

print(token)