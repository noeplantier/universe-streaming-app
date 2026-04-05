import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Force le chargement du fichier .env situé dans le même dossier que ce script
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

print("--- DIAGNOSTIC DE CONNEXION ---")
print(f"🔍 URL trouvée : {url}")
print(f"🔍 Clé trouvée : {'Oui (' + key[:15] + '...)' if key else 'Non'}")
print("-------------------------------\n")

if not url or not key:
    print("❌ ERREUR : Les variables SUPABASE_URL et/ou SUPABASE_KEY sont introuvables.")
    print("Vérifiez que votre fichier s'appelle bien '.env' et contient ces variables.")
    exit(1)

try:
    # Initialisation du client Supabase
    supabase: Client = create_client(url, key)
    print("✅ Client Supabase initialisé.")
    
    # Test de requête : on tente de lire la table 'films' (modifiez si nécessaire)
    print("⏳ Envoi de la requête de test à Supabase...")
    response = supabase.table("films").select("*").limit(1).execute()
    
    print("🎉 CONNEXION RÉUSSIE ! Voici la réponse de la base de données :")
    print(response.data)

except Exception as e:
    print("\n❌ ÉCHEC DE LA REQUÊTE :")
    print(e)
    print("\n💡 Indice: Si l'erreur mentionne 'relation films does not exist', la connexion a RÉUSSI mais la table 'films' n'existe pas encore dans votre base.")