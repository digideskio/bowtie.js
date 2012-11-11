
// This must be set in order for the template class to load via ajax
baseurl = "http://localhost:8080/sandboxjs/";



// we are making a new "database" right here but you might have pulled a much bigger one via ajax
var databaseobj = {
	mydata: {
		ford: {
			statement: "I am a ford!",
			mpg: 10
		},
		chevy: {
			statement: "I am a chevy!",
			mpg: 12
		},
		beetle: {
			statement: "I am a vw beetle with unrealistic gas mileage!",
			mpg: 82
		}
	}
}
// we give bowtie the reference so it can handle includes and such
bowtie.databaseref = databaseobj;


// This is our test data that we will populate our template with
var testdata = {
	var1: 'geoff daigle',
	var2: true,
	var3: 'bob barker',
	var4: 'this is variable #4',
	var5: 'showing var5 because true',
	var6: false,
	var7: 'var6 is false',
	var8: 'pre-modification value',
	// these must be arrays. the looping call will not loop over object properties.
	// the function will iterate over the array elements and merge their variables into the globals above for a "local scope", then evaluate
	var9:  [{
			   varauto: 'ford',
			   var10: '[im-var-10]',
		       var11: '[hello-im-11]'
		   },
		   {
		   	   varauto: 'chevy',
			   var10: '[im-var-10 again]',
		       var11: '[hello-im-11 again]'
		   }],
    var12: [{
    			var8: '[var8 has been modified!]',
    			var13: '[inner-var-12-value-var13]'
           }],
    var14: true
}

// let's populate our dom when it comes time
function showtemplate() {

	$('#hello').html( bowtie.populate('local:fetchtemplate', testdata) );

}

/*
 * Here we set the key (local:fetchtemplate), the relative url of the template (fetchtemplate.html), and the callback function (showtemplate)
 *
 * The key is set up as namespace:index
 * This is for organizational purposes and is useful when you have a large number of templates
 * ex: contacts:overview, contacts:details, contacts:edit
 */

// NOTE: just do this all at once with a json loader and you dont have to loop like this. 
// Myself or someone else will figure out a nicer way of doing individual loading like below.
bowtie.load('local:fetchtemplate', baseurl+'fetchtemplate.html', function(){
	bowtie.load('local:tempfromtemp', baseurl+'includedtemplate.html', showtemplate);
});

