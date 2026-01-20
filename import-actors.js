/**
 * Flee, Mortals! Actor Import Script for Foundry VTT v13
 * 
 * This script imports the generated actor JSON files into Foundry VTT.
 * Run this in the browser console (F12) while in Foundry.
 * 
 * Prerequisites:
 * 1. The flee-mortals-custom module must be installed and enabled
 * 2. You must be logged in as a GM
 * 3. The JSON files must be in the module's actors/ directory
 * 
 * Usage:
 * 1. Open Foundry VTT and load your world
 * 2. Press F12 to open the browser console
 * 3. Copy and paste this entire script
 * 4. Run: await importFleeMortals()
 */

// Configuration
const MODULE_ID = "flee-mortals-custom";
const BATCH_SIZE = 10; // Number of actors to create at once
const DELAY_BETWEEN_BATCHES = 100; // ms

/**
 * Main import function
 */
async function importFleeMortals() {
    console.log("=".repeat(60));
    console.log("Flee, Mortals! Importer for Foundry VTT v13");
    console.log("=".repeat(60));
    
    // Check if module is active
    const module = game.modules.get(MODULE_ID);
    if (!module?.active) {
        console.error(`Module '${MODULE_ID}' is not installed or not active!`);
        console.log("Please install and enable the module first.");
        return;
    }
    
    // Check if user is GM
    if (!game.user.isGM) {
        console.error("You must be a GM to import actors!");
        return;
    }
    
    console.log("Module found and active. Starting import...");
    
    // Get or create the compendiums
    const packs = {
        creatures: await getOrCreatePack("creatures", "Flee, Mortals! Creatures"),
        companions: await getOrCreatePack("companions", "Flee, Mortals! Companions"),
        retainers: await getOrCreatePack("retainers", "Flee, Mortals! Retainers")
    };
    
    // Import from each category
    const results = {
        creatures: await importCategory("creatures", packs.creatures),
        companions: await importCategory("companions", packs.companions),
        retainers: await importCategory("retainers", packs.retainers)
    };
    
    // Summary
    console.log("");
    console.log("=".repeat(60));
    console.log("Import Complete!");
    console.log("=".repeat(60));
    console.log(`Creatures: ${results.creatures.success} imported, ${results.creatures.errors} errors`);
    console.log(`Companions: ${results.companions.success} imported, ${results.companions.errors} errors`);
    console.log(`Retainers: ${results.retainers.success} imported, ${results.retainers.errors} errors`);
    
    const total = results.creatures.success + results.companions.success + results.retainers.success;
    console.log(`Total: ${total} actors imported`);
    
    ui.notifications.info(`Flee, Mortals! Import complete: ${total} actors imported`);
    
    return results;
}

/**
 * Get an existing compendium or create a new world compendium
 */
async function getOrCreatePack(name, label) {
    const packId = `world.fm-${name}`;
    
    // Check if pack exists
    let pack = game.packs.get(packId);
    
    if (!pack) {
        // Create new world compendium
        console.log(`Creating compendium: ${label}`);
        pack = await CompendiumCollection.createCompendium({
            name: `fm-${name}`,
            label: label,
            type: "Actor",
            system: "dnd5e"
        });
    } else {
        console.log(`Found existing compendium: ${label}`);
    }
    
    // Unlock if locked
    if (pack.locked) {
        await pack.configure({ locked: false });
    }
    
    return pack;
}

/**
 * Import all actors from a category folder
 */
async function importCategory(category, pack) {
    console.log(`\nImporting ${category}...`);
    
    const basePath = `modules/${MODULE_ID}/actors/${category}`;
    let success = 0;
    let errors = 0;
    
    // Try to fetch the directory listing
    // Since we can't list directories, we'll need to load the manifest
    const manifestPath = `modules/${MODULE_ID}/actors/${category}/manifest.json`;
    let files = [];
    
    try {
        const response = await fetch(manifestPath);
        if (response.ok) {
            files = await response.json();
        }
    } catch (e) {
        console.log(`No manifest found for ${category}, trying alternative method...`);
    }
    
    // If no manifest, try to load from a known list
    if (files.length === 0) {
        console.log(`Attempting to load actors from individual files...`);
        // We'll need to generate this list from the PowerShell script
        // For now, show instructions
        console.log(`Please run: await importFromFiles('${category}')`);
        return { success: 0, errors: 0, skipped: true };
    }
    
    // Process in batches
    const batches = [];
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        batches.push(files.slice(i, i + BATCH_SIZE));
    }
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`Processing batch ${batchIndex + 1}/${batches.length}...`);
        
        const promises = batch.map(async (file) => {
            try {
                const response = await fetch(`${basePath}/${file}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                const actorData = await response.json();
                
                // Remove the _id so Foundry generates a new one
                delete actorData._id;
                
                // Create the actor in the compendium
                await pack.createDocument(actorData);
                return { success: true };
            } catch (e) {
                console.error(`Failed to import ${file}: ${e.message}`);
                return { success: false, error: e.message };
            }
        });
        
        const results = await Promise.all(promises);
        success += results.filter(r => r.success).length;
        errors += results.filter(r => !r.success).length;
        
        // Delay between batches
        if (batchIndex < batches.length - 1) {
            await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
        }
    }
    
    console.log(`${category}: ${success} imported, ${errors} errors`);
    return { success, errors };
}

/**
 * Alternative import method - import from a folder of JSON files
 * Call this with the folder containing your actor JSONs
 */
async function importFromFolder(folder) {
    console.log(`Importing from folder: ${folder}`);
    
    const pack = await getOrCreatePack("creatures", "Flee, Mortals! Creatures");
    
    // This requires FilePicker which only works with user data paths
    const picker = new FilePicker({ type: "folder" });
    
    console.log("Use the Foundry file picker to select the folder with JSON files");
    console.log("Or use importFromJsonArray() with the data directly");
}

/**
 * Import actors from a JSON array pasted directly
 * Usage: await importFromJsonArray([...array of actor objects...])
 */
async function importFromJsonArray(actors, packName = "creatures") {
    console.log(`Importing ${actors.length} actors...`);
    
    const packLabels = {
        creatures: "Flee, Mortals! Creatures",
        companions: "Flee, Mortals! Companions",
        retainers: "Flee, Mortals! Retainers"
    };
    
    const pack = await getOrCreatePack(packName, packLabels[packName] || "Flee, Mortals!");
    
    let success = 0;
    let errors = 0;
    
    for (let i = 0; i < actors.length; i++) {
        try {
            const actorData = actors[i];
            delete actorData._id; // Let Foundry generate new ID
            
            await pack.createDocument(actorData);
            success++;
            
            if ((i + 1) % 10 === 0) {
                console.log(`Progress: ${i + 1}/${actors.length}`);
            }
        } catch (e) {
            console.error(`Failed to import actor ${i}: ${e.message}`);
            errors++;
        }
    }
    
    console.log(`Import complete: ${success} success, ${errors} errors`);
    return { success, errors };
}

/**
 * Import a single actor from JSON object
 */
async function importSingleActor(actorData, packName = "creatures") {
    const packLabels = {
        creatures: "Flee, Mortals! Creatures",
        companions: "Flee, Mortals! Companions",
        retainers: "Flee, Mortals! Retainers"
    };
    
    const pack = await getOrCreatePack(packName, packLabels[packName] || "Flee, Mortals!");
    
    delete actorData._id;
    const actor = await pack.createDocument(actorData);
    
    console.log(`Imported: ${actor.name}`);
    return actor;
}

/**
 * Clear all actors from a compendium (use with caution!)
 */
async function clearCompendium(packName) {
    const packId = `world.fm-${packName}`;
    const pack = game.packs.get(packId);
    
    if (!pack) {
        console.error(`Compendium not found: ${packId}`);
        return;
    }
    
    if (pack.locked) {
        await pack.configure({ locked: false });
    }
    
    const documents = await pack.getDocuments();
    console.log(`Deleting ${documents.length} actors from ${packName}...`);
    
    for (const doc of documents) {
        await doc.delete();
    }
    
    console.log("Done!");
}

// Export functions to global scope
window.importFleeMortals = importFleeMortals;
window.importFromJsonArray = importFromJsonArray;
window.importSingleActor = importSingleActor;
window.clearCompendium = clearCompendium;

console.log("Flee, Mortals! Import Script Loaded");
console.log("Available commands:");
console.log("  await importFleeMortals()         - Import all from module");
console.log("  await importFromJsonArray(array)  - Import from JSON array");
console.log("  await importSingleActor(obj)      - Import single actor");
console.log("  await clearCompendium('creatures') - Clear a compendium");
