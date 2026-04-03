import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanDb() {
  try {
    console.log("Limpiando base de datos...");
    
    // Delete in order of dependencies
    await prisma.aIChatLog.deleteMany({});
    console.log("✓ Eliminados AI Chat Logs");
    
    await prisma.measurement.deleteMany({});
    console.log("✓ Eliminados Measurements");
    
    await prisma.userProfile.deleteMany({});
    console.log("✓ Eliminados User Profiles");
    
    await prisma.user.deleteMany({});
    console.log("✓ Eliminados Users");
    
    await prisma.gym.deleteMany({});
    console.log("✓ Eliminados Gyms");
    
    console.log("\n✅ Base de datos limpiada correctamente");
  } catch (error) {
    console.error("❌ Error al limpiar la BD:", error instanceof Error ? error.message : String(error));
  } finally {
    await prisma.$disconnect();
  }
}

cleanDb();
