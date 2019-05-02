var argv = require('minimist')(process.argv.slice(2));
const csv = require('csv-parser');
const fs = require('fs');
const uuidv4 = require('uuid/v4');
let results = [];
 

let templateContents = JSON.parse(fs.readFileSync(argv.template, "utf-8"));
let billingCmds = templateContents.tests.find(t => t.name.toLowerCase() === 'billing');

function die(str){
    console.error(str);
    process.exit(1);
}



fs.createReadStream(argv.input)
  .pipe(csv())
  .on('data', (data) => results.push(data))
  .on('end', () => {
    let tests = [];

    results.forEach(row => {
        const startDate = row['STARTDATE'];
        if (startDate){

            // Replace vars
            let test = JSON.parse(JSON.stringify(billingCmds));
            test.commands.forEach(command => {
                // Handle special cases
                let comment = command.comment.trim();

                if (comment === "#START DATE SCRIPT#"){
                    if (row.STARTDATE === undefined) die("STARTDATE is not defined");

                    command.target = `return "${row.STARTDATE}"`;
                }else if (comment.startsWith("#")){
                    let varName = comment.replace(/#/g, "");
                    let varValue = row[varName];
                    if (varValue === undefined) die("Could not find variable " + varName + " exiting...");
                    
                    // Special case, pad 0s to date, remove slashes
                    if (varName === "STARTDATE"){
                        var sd = new Date(varValue);
                        varValue = (sd.getMonth() + 1).toString().padStart(2, '0') + 
                                    sd.getDay().toString().padStart(2, '0') +
                                    sd.getFullYear().toString()
                    }

                    if (command.value.startsWith("label=")){
                        command.value = "label=" + varValue; 
                    }else{
                        command.value = varValue;
                    }

                }
            });
            
            test.id = uuidv4()
            test.name = row["FIRSTNAME"] + " " + row["LASTNAME"];
            tests.push(test);
        }else{
            // Empty/Invalid
        }
    });

    // Generate final template
    templateContents.tests = tests;

    const destination = "auto_entry_mnits.side";
    fs.writeFileSync(destination, JSON.stringify(templateContents));
    
    console.log(`File written to ${destination} :)`);
  });
