# ============================================================
# COMANDOS PARA CORRER EN EL SERVIDOR DE PRODUCCIÓN VÍA SSH
# Servidor: 129.213.108.102
# ============================================================

# 1. Verificar si el servidor puede resolver el DNS de Atlas
nslookup cluster0.vtkafrd.mongodb.net

# 2. Verificar si el puerto 27017 está accesible (MongoDB Atlas usa este puerto)
#    Si no hay respuesta / timeout → el firewall de Oracle Cloud lo bloquea
nc -zv cluster0.vtkafrd.mongodb.net 27017
# Alternativa si nc no está disponible:
timeout 5 bash -c 'cat < /dev/null > /dev/tcp/cluster0.vtkafrd.mongodb.net/27017' && echo "✅ Puerto 27017 ABIERTO" || echo "❌ Puerto 27017 BLOQUEADO"

# 3. Verificar también puerto 27016 (Atlas usa rango 27015-27017)
timeout 5 bash -c 'cat < /dev/null > /dev/tcp/cluster0.vtkafrd.mongodb.net/27016' && echo "✅ Puerto 27016 ABIERTO" || echo "❌ Puerto 27016 BLOQUEADO"

# 4. Si los puertos están bloqueados, en Oracle Cloud debes abrir:
#    Network > Virtual Cloud Networks > Subnet > Security List > Add Egress Rule
#    Destination CIDR: 0.0.0.0/0
#    IP Protocol: TCP
#    Destination Port Range: 27015-27017
