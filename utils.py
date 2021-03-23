import os
from pathlib import Path
from shutil import copyfile
import re 
import platform
import torch
import pickle
import numpy as np
import pandas as pd
import networkx as nx
import re
import multiprocessing


metadata_calibre = pickle.load(open( "pickled_metadata/calibre_metadata.p", "rb" ))
calibre_regex = pickle.load(open( "pickled_metadata/calibre_regex.p", "rb" ))

metadata_goodreads = pickle.load(open( "pickled_metadata/metadata_goodreads.p", "rb" ))
goodreads_regex = pickle.load(open( "pickled_metadata/goodreads_regex.p", "rb" ))




def find_any_book_goodreads(s):
    return re.findall(goodreads_regex, s)

def find_any_book_calibre(s):
    return re.findall(calibre_regex, s)


def save_dataset(results,path):
    results = [i for i in results if i] 
    label_dataset = ''

    for _,_,datasetpieces in results:
        for p in datasetpieces:
            label_dataset+=p
            
    with open(path,'w+') as f:
        f.write(label_dataset)
        f.close()

        
def add_to_graph(results,G,is_goodreads=False):
    # remove None values
    results = [i for i in results if i] 

    for current_book_name,edges,_ in results:
        for edge in edges:
            if not G.has_edge(*edge):
                

                if(is_goodreads):
                    G.add_node(edge[1],attr={'goodreads_node':1})
                else:
                    G.add_node(edge[0])
                    G.add_node(edge[1])  
                    
                G.add_edge(*edge)




def make_dataset_entry(book,line,book_detected):
    pos_init = line.find(book)
    pos_end = pos_init + len(book) 

    with_context = line
    line_backup = line
    try:
        m_left = re.search(r"^\.?(.*)$", line[:pos_init])[0]
        m_right = re.search(r"^(\.?[^.]+\.?)", line[pos_end:])[0]

        with_context = m_left + book + m_right
        with_context = with_context.replace('\n','').replace('\“','\'').replace('\"','\'').replace('\t','')

        piece_dataset = (f'{{"text": "{with_context}" , "labels":["positive"], "detected_ner":"{book_detected}", "meta":{{"book":"{line[pos_init:pos_end]}"}} }}' + "\n")
        
        return piece_dataset
    
    except AttributeError:
        return None
    except TypeError:
        return None

    
def search_book_pubdate_by_alias(book_alias,using_goodreads):
    
    global metadata_calibre
    #global metadata_goodreads
    
    try:
        if (using_goodreads):
            return metadata_goodreads.query(f'clean_title=="{book_alias}"')['year_first_published'].values[0]
        else:
            return metadata_calibre.query(f'clean_title=="{book_alias}"')['pubdate'].values[0].split('-')[0]
    except:
        if(using_goodreads):            
            for id_book,aliases_list in zip(metadata_goodreads['bookID'],metadata_goodreads['aliases']):
                if book_alias in aliases_list:
                    return metadata_goodreads.query(f'bookID=={id_book}')['year_first_published'].values[0]
        else:
            for id_book,aliases_list in zip(metadata_calibre.index,metadata_calibre['aliases']):
                if book_alias in aliases_list:
                    return metadata_calibre.query(f'id=={id_book}')['pubdate'].values[0].split('-')[0]
        print('nao achei',book_alias)

        
def check_if_citation_ner(model,tokenizer,sentence):
    
    inputs = tokenizer(sentence, return_tensors="pt",truncation=True,padding=True)

    logits = model(**inputs)
    idx = torch.nonzero(torch.argmax(logits[0][0],axis=1))
    book = ""
    if (len(idx)):
        ids_labeled = inputs.input_ids[0][idx]
        tokens = tokenizer.convert_ids_to_tokens(ids_labeled)
        book = tokenizer.convert_tokens_to_string(tokens).strip()
    

    return book
        
        
        
class BookProcesserFactory:
    
    def __init__(self, use_citation_model= False,
                       create_dataset = True,
                        verbose = False,
                        metadata_to_use = 'calibre'):
        
        self.use_citation_model = use_citation_model
        self.create_dataset = create_dataset
        self.verbose = verbose
        
        if (metadata_to_use == 'calibre'):
            self.lookup_func = find_any_book_calibre
        elif (metadata_to_use == 'goodreads'):
            self.lookup_func = find_any_book_goodreads   
        else:
            raise('Please select valid metadata')
            
    def GetProcessFunction(self):
        
        use_citation_model = self.use_citation_model
        create_dataset = self.create_dataset
        lookup_func = self.lookup_func
        
        def process_book(tup,model,tokenizer):
                global metadata_calibre
                #global metadata_goodreads
                
                roberta_calls = 0
                
                id_book,aliases_current_book,current_book_name,book_lines_list = tup 

                using_goodreads = False
                # i don't have this book on my personal list
                if lookup_func("ewewe Moby-Dick wewe"):
                    using_goodreads = True

                excluded_books = ['King Lear','Hamlet','The Tempest','Othello','The Odyssey','Ulysses']

                if(current_book_name not in excluded_books): 
                        pieces_dataset = []
                        edges_to_add = []


                        for line in book_lines_list:
                            match = lookup_func(line)

                            if(match):
                                book = match[0]

                                # cant use this on lines that are too big
                                is_citation = True
                                if (len(book.split())<3 and use_citation_model):

                                    try:
                                        book_detected = check_if_citation_ner(model,tokenizer,line)
                                        roberta_calls+=1
                                        if (book_detected.find(book)!=-1 or book.find(book_detected)!=-1):
                                            is_citation= True
                                        else:
                                            is_citation = False
                                    except Exception as e:
                                        print(e)
                                        print(f'failed on book {current_book_name}')
                                        print(line)
                                        is_citation = True
                                        break
                                else:
                                    book_detected = -1
                                    # if the name of the book is long it is unlikely it is not a citation
                                    is_citation = True                 

                                # check if citation is possible
                                # e.g. if cited book is older than citing book
                                publishing_date_current_book = metadata_calibre.query(f"id=={id_book}").pubdate.values[0].split('-')[0]

                                publishing_date_target_book = search_book_pubdate_by_alias(book,using_goodreads)

                                if int(publishing_date_current_book) > int(publishing_date_target_book):
                                    no_time_traveling = True
                                else:
                                    #print(f'{current_book_name} {publishing_date_current_book} cannot cite {book} {publishing_date_target_book}')
                                    no_time_traveling = False


                                # the problematic books are single or 2 words long
                                # e.g. Critique of Pure Reason would never show up unless it is cited 
                                if (create_dataset and len(book.split())<3):
                                     dataset_piece = make_dataset_entry(book,line,book_detected)
                                     if(dataset_piece):
                                        pieces_dataset.append(dataset_piece)

                                if(is_citation and no_time_traveling):
                                    # citations of a book to itself are pointless
                                    if(book != current_book_name and book not in aliases_current_book):
                                        edge = (current_book_name, book)
                                        edges_to_add.append(edge)
                        return (current_book_name,edges_to_add,pieces_dataset)
        return process_book

