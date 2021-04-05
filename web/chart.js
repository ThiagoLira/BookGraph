
var colors = d3.scaleOrdinal(d3.schemeCategory10);

let ifClicked = false;
width = document.getElementById('canvas').clientWidth;
height = document.getElementById('canvas').clientHeight;

var svg = d3.select("svg"),
    node,
    link;
//    width = +svg.attr("width"),
//    height = +svg.attr("height"),


// select dropdown

var dropdown = d3.select("#selector")
                    .insert("select", "svg");

d3.selectAll('#selector select').style('width','300px')




const baseGroup = svg.append("g");

const menuItems = baseGroup.selectAll(".menuitems")

const isConnectedAsSource = (a, b) => linkedByIndex[`${a},${b}`];
const isConnectedAsTarget = (a, b) => linkedByIndex[`${b},${a}`];
const isConnected = (a, b) => isConnectedAsTarget(a, b) || isConnectedAsSource(a, b) || a === b;
const isEqual = (a, b) => a === b;
const nodeRadius = d => 15 * 1



svg.append('defs').append('marker')
    .attrs({
    'id': 'arrowhead',
    'viewBox': '-0 -5 10 10',
    'refX': 13,
    'refY': 0,
    'orient': 'auto',
    'markerWidth': 13,
    'markerHeight': 13,
    'xoverflow': 'visible'
    })
    .append('svg:path')
    .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
    .attr('fill', '#999')
    .style('stroke', 'none');



// table with metadata
d3.csv("book_metadata.csv", function (error, data) {
    if (error) throw error;

    var sortAscending = true;

    var table = d3.select('#page-wrap').append('table');
    var titles = d3.keys(data[0]);
    var headers = table.append('thead').append('tr')
    .selectAll('th')
    .data(titles).enter()
    .append('th')
    .text(function (d) {
        return d;
    })
    .on('click', function (d) {
        headers.attr('class', 'header');

        if (sortAscending) {
        rows.sort(function (a, b) { return b[d] < a[d]; });
        sortAscending = false;
        this.className = 'aes';
        } else {
        rows.sort(function (a, b) { return b[d] > a[d]; });
        sortAscending = true;
        this.className = 'des';
        }

    });

    var rows = table.append('tbody').selectAll('tr')
    .data(data).enter()
    .append('tr');
    rows.selectAll('td')
    .data(function (d) {
        return titles.map(function (k) {
        return { 'value': d[k], 'name': k };
        });
    }).enter()
    .append('td')
    .attr('data-th', function (d) {
        return d.name;
    })
    .text(function (d) {
        return d.value;
    });

    d3.selectAll('tr').on("click", mouseClickFunctionTable)

});


function get_pos(coord,graph) {

    height_base = 800 


    distinct_groups = [...new Set(graph.nodes.map(item=>item.category_date))].sort()
    n_distinct_groups = distinct_groups.length;
    
    return function (d) {



    group_char = d.category_date
    
    if (d.is_goodreads == 1){
        height_node = height_base - 400
    }else{
        height_node = height_base
    }


    var index_on_groups = distinct_groups.findIndex(x=>x == d.category_date)
    
    if (coord == 'x') { return width / (n_distinct_groups - index_on_groups + 1)*1.3 }
    if (coord == 'y') { return height_node }
        
    }

}



d3.json("graph.json", function (error, graph) {
    if (error) throw error;
    links = graph.links
    nodes = graph.nodes
    // create link reference
    links.forEach(d => {
    linkedByIndex[`${d.source},${d.target}`] = true;
    });


    get_pos_x = get_pos('x',graph)
    get_pos_y = get_pos('y',graph)
    
    simulation = d3.forceSimulation()
    .force("collide", d3.forceCollide(function (d) { return d.nodesize  }).iterations(2))
    .force("x", d3.forceX().x(get_pos_x).strength(1))
    .force("y", d3.forceY().y(get_pos_y).strength(1))
    .force("link", d3.forceLink().id(function (d) { return d.id; }).strength(0.0001))
    //.force("charge", d3.forceManyBody())
    //.force("center", d3.forceCenter(width / 2, height / 2))
    
    update(graph.links, graph.nodes);



})










var links = []
var nodes = []
var linkedByIndex = {};




function update(links, nodes) {
    link = svg.selectAll(".link")
    .data(links)
    .enter()
    .append("line")
    .attr("class", "link")
    .attr('marker-end', 'url(#arrowhead)')

    link.append("title")
    .text(function (d) { return d.type; });

    edgepaths = svg.selectAll(".edgepath")
    .data(links)
    .enter()
    .append('path')
    .attrs({
        'class': 'edgepath',
        'fill-opacity': 0,
        'stroke-opacity': 0,
        'id': function (d, i) { return 'edgepath' + i }
    })
    .style("pointer-events", "none");


    node = svg.selectAll(".node")
    .data(nodes)
    .enter()
    .append("g")
    .attr("class", "node")
    .call(d3.drag()
        .on("start", function () { })//dragstarted)
        .on("drag", function () { })//dragged)

        //.on("end", dragended)
    );



    node.append("circle")
    .attr("r", function (d) { return d.nodesize })
    .style("fill", function (d, i) { 
        
        if (d.is_goodreads){
        return colors(i)
        }
        else{
        return colors(i); 
        }  
    
    
    })

    //node.append("title")
    //    .text(function (d) {return d.id;});

    // node.append("text")
    // .attr("dy", -3)
    // .text(function (d) {return d.name;})
    // .style('opacity' , 1);

    simulation
    .nodes(nodes)
    .on("tick", ticked);

    simulation.force("link")
    .links(links);


    node.on('mouseout', mouseOutFunction)
    .on('mouseover', mouseOverFunction)
    .on('click', mouseClickFunction)


    // populate dropdown menu with authors
    dropdown.selectAll("option")
                    .data(nodes)
                    .enter().append("option")
                        .attr("value", function (d) { return d['authors']; })
                        .text(function (d) {
                            return d['authors'] 
                        });

// register function                       
dropdown.on('change',dropdownChange)

}

function ticked() {
    link
    .attr("x1", function (d) { return d.source.x; })
    .attr("y1", function (d) { return d.source.y; })
    .attr("x2", function (d) { return d.target.x; })
    .attr("y2", function (d) { return d.target.y; });

    node
    .attr("transform", function (d) { return "translate(" + d.x + ", " + d.y + ")"; });


    edgepaths.attr('d', function (d) {
    return 'M ' + d.source.x + ' ' + d.source.y + ' L ' + d.target.x + ' ' + d.target.y;
    });



}


const mouseOverFunction = d => {

    if (ifClicked) return;

    node
    .append("text")
    .attr("class", "mylabel")//adding a label class
    .attr("dy", -3)
    .text(function (o) {

        const isConnectedValue = isConnected(o.id, d.id);
        if (isConnectedValue) {
        return `${o.name} by: \n ${o.authors}`;
        } return ""
    })

    

    node
    .transition(500)
    .style('opacity', o => {
        const isConnectedValue = isConnected(o.id, d.id);
        if (isConnectedValue) {
        return 1.0;
        }
        return 0.1;
    });


    link
    .transition(500)
    .style('stroke-opacity', o => {
        return (o.source === d || o.target === d ? 1 : 0.1)
    })
    .transition(500)
    .attr('marker-end', o => (o.source === d || o.target === d ? 'url(#arrowhead)' : 'url()'));
};


const mouseOutFunction = d => {
    if (ifClicked) return;

    //remove labels from mouseon function   
    d3.selectAll(".mylabel").remove()


    node
    .transition(500)
    .style('opacity', 1);

    link
    .transition(500)
    .style("stroke-opacity", o => {
    });

};



const populaTableAfterClick = (nodes_target,nodes_source,book_name) => {


    // delete current table 
    d3.selectAll('.temp-table').remove()
    d3.selectAll('.temptext').remove()



    var sortAscending = true;

    // table TARGET


    d3.select('#current-selection-outgoing')
                            .append('text')
                            .attr('class','temptext')
                            .style('font-size','20px')
                            .text(`Cited by this book: ${book_name}`)

    var table_target = d3.select('#current-selection-outgoing').append('table')
                        .attr("class", "temp-table");





    table_target.append('thead');
    table_target.append('tbody');

// create the table header
var thead_target = table_target.select("thead").selectAll("th")
    .data(d3.keys(nodes_target[0]))
    .enter().append("th").text(function(d){return d});

    // fill the table
// create rows
var tr_target = table_target.select("tbody").selectAll("tr")
    .data(nodes_target).enter().append("tr")

// cells
var td_target = tr_target.selectAll("td")
    .data(function(d){return d3.values(d)})
    .enter().append("td")
    .text(function(d) {return d})

    // table SOURCE

    d3.select('#current-selection-ingoing')
                            .append('text')
                            .attr('class','temptext')
                            .style('font-size','20px')
                            .text(`Cites this book: ${book_name}`)

    var table_source = d3.select('#current-selection-ingoing').append('table')
                        .attr("class", "temp-table");


    table_source.append('thead');
    table_source.append('tbody');

// create the table header
var thead_source = table_source.select("thead").selectAll("th")
    .data(d3.keys(nodes_source[0]))
    .enter().append("th").text(function(d){return d});

    // fill the table
// create rows
var tr_source = table_source.select("tbody").selectAll("tr")
    .data(nodes_source).enter().append("tr")

// cells
var td_source = tr_source.selectAll("td")
    .data(function(d){return d3.values(d)})
    .enter().append("td")
    .text(function(d) {return d})



}


const mouseClickFunctionTable = d => {

    ifClicked = true;

    var elmnt = document.getElementById("canvas");
    elmnt.scrollIntoView();

    // get reference to node with same id from table row
    var this_node_id = node._groups[0].filter(function (f) { return f.__data__.name === d.clean_title })[0].__data__.id
    var this_node_name = node._groups[0].filter(function (f) { return f.__data__.name === d.clean_title })[0].__data__.name

    node
    .append("text")
    .attr("dy", -3)
    .attr("class", "mylabel")//adding a label class
    .text(function (o) {

        const isConnectedValue = isConnected(o.id, this_node_id);
        if (isConnectedValue) {
        return `${o.name} by: \n ${o.authors}`;
        } return ""
    })

    node
    .transition(500)
    .style('opacity', o => {
        const isConnectedValue = isConnected(o.id, this_node_id);
        if (isConnectedValue) {
        return 1.0;
        }
        return 0.1
    })

    link
    .transition(500)
    .style('stroke-opacity', o => (o.source.name === this_node_name || o.target.name === this_node_name ? 1 : 0.1))
    .transition(500)
    .attr('marker-end', o => (o.source.name === this_node_name || o.target.name === this_node_name ? 'url(#arrowhead)' : 'url()'));

}


const dropdownChange = () => {

    var elmnt = document.getElementById("canvas");
    elmnt.scrollIntoView();
    
    ifClicked = true;
    
    // we don't want the click event bubble up to svg
    d3.event.stopPropagation();

    //remove labels from mouseon function   
    d3.selectAll(".mylabel").remove()
    
    var selectedAuthor = d3.selectAll("select").property('value')

    var nodes_author = node._groups[0].filter(function (f) { return f.__data__.authors === selectedAuthor })

    node
    .append("text")
    .attr("dy", -3)
    .attr("class", "mylabel")//adding a label class
    .text(function (o) {
        
        isConnectedValue = nodes_author.reduce((acc,i)=> {
            return acc || ( isConnected(o.id,i.__data__.id)) 
        },false)
        

        if (isConnectedValue) {
        return `${o.name} by: \n ${o.authors}`;
        } return ""
    })

    node
        .transition(500)
        .style('opacity', o => {
        isConnectedValue = nodes_author.reduce((acc,i)=> {
                return acc || ( isConnected(o.id,i.__data__.id)) 
        },false)
        if (isConnectedValue) {
            return 1.0;
        }
        return 0.1
        })

        link
        .transition(500)
        .style('stroke-opacity', o => {

            isConnectedValue = nodes_author.reduce((acc,i)=> {
                return acc || ( o.target.name===i.__data__.name || o.source.name===i.__data__.name ) 
            },false)

            return isConnectedValue ? 1 : 0.1;

            
        })
        .attr('marker-end', o => {
            isConnectedValue = nodes_author.reduce((acc,i)=> {
                return acc || ( o.target.name===i.__data__.name || o.source.name===i.__data__.name ) 
            },false)

            return isConnectedValue ? 'url(#arrowhead)' : 'url()';
        });

}


const mouseClickFunction = d => {
    // we don't want the click event bubble up to svg
    d3.event.stopPropagation();

    //remove labels from mouseon function   
    d3.selectAll(".mylabel").remove()

    menuItems.attr('visibility', "hidden");

    ifClicked = true;

    node
    .transition(500)
    .style('opacity', 1)

    link
    .transition(500);

    node
    .transition(500)
    .style('opacity', o => {
        const isConnectedValue = isConnected(o.id, d.id);
        if (isConnectedValue) {
        return 1.0;
        }
        return 0.1
    })

    link
    .transition(500)
    .style('stroke-opacity', o => (o.source === d || o.target === d ? 1 : 0.1))
    .transition(500)
    .attr('marker-end', o => (o.source === d || o.target === d ? 'url(#arrowhead)' : 'url()'));



    node
    .append("text")
    .attr("dy", -3)
    .attr("class", "mylabel")//adding a label class
    .text(function (o) {

        const isConnectedValue = isConnected(o.id, d.id);
        if (isConnectedValue) {
        return `${o.name} by: \n ${o.authors}`;
        } return ""
    })
    
// populate table with related nodes from clicked
nodes_target = nodes.filter(function(f){return isConnectedAsTarget(f.id,d.id)})
nodes_source = nodes.filter(function(f){return isConnectedAsSource(f.id,d.id)})
// filter only relevant data
nodes_target = nodes_target.map(d=>{return {name: d.name , authors: d.authors.split('&')[0]}})
nodes_source = nodes_source.map(d=>{return {name: d.name , authors: d.authors.split('&')[0]}})
populaTableAfterClick(nodes_target,nodes_source,d.name);
};



svg.on('click', () => {
    ifClicked = false;
    //remove labels from mouseon function   
    d3.selectAll(".mylabel").remove()
    d3.selectAll("#selected-book").selectAll('h2').remove()

    // delete current tables for citations from previously clicked node 
    d3.selectAll('.temp-table').remove()
    d3.selectAll('.temptext').remove()
    
    node
    .transition(500)
    .style('opacity', 1);

    link
    .transition(500)
    .style("stroke-opacity", 0.5)

    menuItems.attr('visibility', "hidden");
});

