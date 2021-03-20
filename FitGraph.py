import os
import re 
import platform
import torch
import pickle
import numpy as np
import pandas as pd
import networkx as nx
import re
from utils import BookProcesserFactory
from utils import metadata_calibre
from utils import add_to_graph

from transformers import RobertaTokenizer, RobertaModel,RobertaForTokenClassification


from utils import add_to_graph,save_dataset
    
from tqdm import tqdm

from multiprocess import Pool 
import multiprocess as mp
import itertools
import argparse

if __name__ == "__main__":

    
    
    parser = argparse.ArgumentParser()
    
    parser.add_argument("--use_goodreads", help="calculate citation graph with external goodreads database")
    parser.add_argument("--use_citation_model", help="wheter to use NER model to remove false positives from detected citations")

    
    args = parser.parse_args()

    metadata_to_use = 'goodreads' if args.use_goodreads else 'calibre'
    
    
    
    model = RobertaForTokenClassification.from_pretrained('fine-tuned-model-ner-better-data-2')
    tokenizer = RobertaTokenizer.from_pretrained('roberta-base')

    model.share_memory()

    
    bkp = BookProcesserFactory(create_dataset = True,
                        verbose = False,
                        use_citation_model = args.use_citation_model,
                        metadata_to_use = metadata_to_use       
                    )

    book_processer = bkp.GetProcessFunction()
    
    
    if args.use_goodreads:
        # if it doesn't find the file read the script first without the --use_goodreads argument
        G = pickle.load(open( "pickled_graphs/small_graph.p", "rb" ))
    else:
        G = nx.DiGraph()
    
    books_memory = []
    
    for id_ in metadata_calibre.index:
        with open(f'books_raw/{id_}.txt', 'r') as book_text:
            books_memory.append(book_text.readlines())
    
    iterator = list(zip(metadata_calibre.index,
                        metadata_calibre['aliases'],
                        metadata_calibre['clean_title'],
                        books_memory))


    ctx = mp.get_context('spawn')
    
    num_workers = 20 if not args.use_citation_model else 4
    
    p = ctx.Pool(num_workers)

    f = book_processer

    jobs = []
    send_models = True


    for i in range(len(iterator)):
        
        if args.use_citation_model:
            job = p.apply_async(f, [iterator[i],model,tokenizer])
        else:
            job = p.apply_async(f, [iterator[i],None,None])
            
        jobs.append(job)

    results=[]
    
    print(f"Started processing graph using {metadata_to_use} data, with {num_workers} workers.")
    
    if (args.use_citation_model):
        print(f"I am using the NER model")
    else:
        print(f"I am NOT using the NER model")
       

    for job in tqdm(jobs):
        results.append(job.get())


    add_to_graph(results,G,is_goodreads=args.use_goodreads)
    
    if (args.use_goodreads):
        pickle.dump( G, open( "pickled_graphs/complete_graph_by_script.p", "wb" ) )
    else:
        pickle.dump( G, open( "pickled_graphs/small_graph.p", "wb" ) )

    
    save_dataset(results,'to_annotate/output_ner_multi.jsonl')
